from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv

from utils.db_connector import DatabaseConnector
from utils.question_handler import QuestionHandler
from utils.cache import ResponseCache
from rag.embeddings import EmbeddingManager
from rag.chain import RAGChain

load_dotenv()

app = FastAPI(title="EPL Analytics RAG Chatbot API")

# CORS middleware for frontend - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
db = DatabaseConnector()
question_handler = QuestionHandler(db)
response_cache = ResponseCache(ttl_seconds=1800)  # 30 minute cache
embeddings = EmbeddingManager(persist_directory=os.getenv('CHROMA_DB_PATH', './data/chroma'))
rag_chain = RAGChain()

# Pydantic models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    conversation_history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict]
    confidence: float
    model: str

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "EPL Analytics RAG Chatbot"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Hybrid chat endpoint - uses direct SQL for aggregate questions,
    falls back to RAG + LLM for complex analysis questions.
    Includes caching for faster repeated queries.
    """
    try:
        # Check cache first
        cached_response = response_cache.get(request.question)
        if cached_response:
            return ChatResponse(
                answer=cached_response['answer'],
                sources=cached_response['sources'],
                confidence=cached_response['confidence'],
                model=cached_response['model'] + " (cached)"
            )
        
        # First, try to handle as an aggregate question (instant response)
        aggregate_result = question_handler.handle_aggregate_question(request.question)
        
        if aggregate_result:
            # Cache and return instant response for aggregate questions
            response_data = {
                'answer': aggregate_result['answer'],
                'sources': aggregate_result['sources'],
                'confidence': 0.95,
                'model': "direct-sql"
            }
            response_cache.set(request.question, response_data)
            
            return ChatResponse(
                answer=aggregate_result['answer'],
                sources=aggregate_result['sources'],
                confidence=0.95,  # High confidence for direct SQL queries
                model="direct-sql"
            )
        
        # Fall back to RAG + LLM for complex analysis questions
        # Retrieve relevant matches from vector DB
        search_results = embeddings.search(request.question, n_results=5)

        documents = search_results['documents']
        metadatas = search_results['metadatas']
        distances = search_results['distances']

        # Build context from retrieved documents
        context = rag_chain.build_context(documents)

        # Convert Pydantic models to dicts for the chain
        history = [{"role": msg.role, "content": msg.content} for msg in request.conversation_history]

        # Get response from RAG chain
        response = rag_chain.invoke(
            question=request.question,
            context=context,
            history=history
        )

        # Calculate confidence based on retrieval scores (inverse of distance)
        avg_distance = sum(distances) / len(distances) if distances else 1.0
        confidence = max(0.0, min(1.0, 1.0 - (avg_distance / 2.0)))

        # Format sources - handle both match and player_stats document types
        sources = []
        for meta in metadatas:
            if meta.get('type') == 'player_stats':
                sources.append({
                    "type": "player_stats",
                    "player_name": meta.get('player_name', 'Unknown'),
                    "team": meta.get('team', 'Unknown'),
                    "season": meta.get('season', 'Unknown'),
                    "goals": meta.get('goals', '0')
                })
            else:
                sources.append({
                    "type": "match",
                    "team": meta.get('team', 'Arsenal'),
                    "match_date": meta.get('match_date', 'Unknown'),
                    "opponent": meta.get('opponent', 'Unknown'),
                    "result": meta.get('result', 'Unknown'),
                    "season": meta.get('season', 'Unknown')
                })

        # Cache the RAG response (for repeated questions)
        response_data = {
            'answer': response['answer'],
            'sources': sources,
            'confidence': round(confidence, 2),
            'model': response['model']
        }
        response_cache.set(request.question, response_data)
        
        return ChatResponse(
            answer=response['answer'],
            sources=sources,
            confidence=round(confidence, 2),
            model=response['model']
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.post("/rebuild-embeddings")
async def rebuild_embeddings():
    """
    Rebuild embeddings from database (admin endpoint)
    """
    try:
        # Clear existing embeddings
        embeddings.clear_collection()

        # Fetch all matches
        matches = db.fetch_all_matches()

        # Add matches to vector database
        embeddings.add_matches(matches)

        # Fetch and add player statistics
        player_stats = db.fetch_all_player_stats()
        embeddings.add_player_stats(player_stats)

        return {
            "status": "success",
            "matches_indexed": len(matches),
            "players_indexed": len(player_stats),
            "message": "Embeddings rebuilt successfully with matches and player stats"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rebuilding embeddings: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Get chatbot statistics"""
    try:
        collection_count = embeddings.collection.count()
        cache_stats = response_cache.get_stats()

        return {
            "indexed_documents": collection_count,
            "model": rag_chain.model,
            "embedding_model": "all-MiniLM-L6-v2",
            "vector_db": "ChromaDB",
            "teams": ["Arsenal", "Liverpool", "Manchester City", "Manchester United"],
            "cache": cache_stats,
            "features": ["hybrid_sql", "caching", "multi_team"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cache/clear")
async def clear_cache():
    """Clear the response cache"""
    try:
        response_cache.clear()
        return {"status": "success", "message": "Cache cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
