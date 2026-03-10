#!/bin/bash
# Setup Ollama with recommended model for football analytics

set -e

echo "================================"
echo "OLLAMA SETUP FOR FOOTBALL RAG"
echo "================================"
echo ""

# Check if Ollama container is running
echo "⏳ Checking if Ollama container is running..."
if ! docker ps | grep -q arsenalfc_ollama; then
    echo "❌ Ollama container is not running!"
    echo "Please start it with: docker compose up -d ollama"
    exit 1
fi

echo "✓ Ollama container is running"
echo ""

# Pull the model
MODEL="${1:-qwen2.5:72b}"
echo "📥 Pulling Ollama model: $MODEL"
echo "This may take several minutes depending on model size..."
echo ""

docker exec arsenalfc_ollama ollama pull "$MODEL"

if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "✓ SUCCESS! Model installed: $MODEL"
    echo "================================"
    echo ""
    echo "Available models:"
    docker exec arsenalfc_ollama ollama list
    echo ""
    echo "To test the model:"
    echo "  docker exec -it arsenalfc_ollama ollama run $MODEL"
    echo ""
    echo "Update .env file to use this model:"
    echo "  OLLAMA_MODEL=$MODEL"
    echo ""
else
    echo ""
    echo "❌ Failed to pull model: $MODEL"
    echo ""
    echo "Available alternatives:"
    echo "  - qwen2.5:72b (recommended, best for general tasks)"
    echo "  - llama3.3:70b (great reasoning)"
    echo "  - deepseek-coder-v2 (best for coding)"
    echo "  - mixtral:8x22b (cost-effective)"
    echo ""
    exit 1
fi
