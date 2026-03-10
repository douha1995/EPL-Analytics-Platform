'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';
import {
  Box,
  Heading,
  Select,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Spinner,
  Center,
  Text,
  HStack,
  Badge,
  VStack,
} from '@chakra-ui/react';
import * as d3 from 'd3';

const GET_MATCH_LIST = gql`
  query GetMatchList($season: String!, $team: String!) {
    matchList(season: $season, team: $team) {
      matchId
      matchName
      matchDate
    }
  }
`;

const GET_PASSING_NETWORK = gql`
  query GetPassingNetwork($matchId: String!) {
    matchPlayerNetwork(matchId: $matchId) {
      assister
      shooter
      assistsCount
      goalsFromAssists
      totalXgAssisted
    }
  }
`;

interface PassingNetworkProps {
  season: string;
  team: string;
}

interface Player {
  id: string;
  x: number;
  y: number;
  passes: number;
  assists: number;
}

interface Pass {
  source: string;
  target: string;
  count: number;
}

export default function PassingNetwork({ season, team }: PassingNetworkProps) {
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [venue, setVenue] = useState<'home' | 'away'>('home');
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: matchListData, loading: matchListLoading } = useQuery(GET_MATCH_LIST, {
    variables: { season: season || '2024-25', team: team || 'Arsenal' },
    skip: !season || !team,
  });

  const { data: networkData, loading: networkLoading } = useQuery(GET_PASSING_NETWORK, {
    variables: { matchId: selectedMatch },
    skip: !selectedMatch,
  });

  const matches = matchListData?.matchList || [];
  const network = networkData?.matchPlayerNetwork || [];

  // Calculate network statistics
  const totalPasses = network.reduce((sum: number, link: any) => sum + link.assistsCount, 0);
  const uniquePlayers = new Set([
    ...network.map((n: any) => n.assister),
    ...network.map((n: any) => n.shooter),
  ]).size;

  // Render passing network visualization
  useEffect(() => {
    if (!network || network.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;
    const pitchWidth = 700;
    const pitchHeight = 500;
    const offsetX = 50;
    const offsetY = 50;

    svg.attr('width', width).attr('height', height);

    // Draw pitch
    const pitch = svg.append('g').attr('class', 'pitch');

    // Pitch outline
    pitch
      .append('rect')
      .attr('x', offsetX)
      .attr('y', offsetY)
      .attr('width', pitchWidth)
      .attr('height', pitchHeight)
      .attr('fill', '#1a472a')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Center line
    pitch
      .append('line')
      .attr('x1', offsetX + pitchWidth / 2)
      .attr('y1', offsetY)
      .attr('x2', offsetX + pitchWidth / 2)
      .attr('y2', offsetY + pitchHeight)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Center circle
    pitch
      .append('circle')
      .attr('cx', offsetX + pitchWidth / 2)
      .attr('cy', offsetY + pitchHeight / 2)
      .attr('r', 60)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Penalty areas
    const penaltyWidth = 120;
    const penaltyHeight = 300;
    const penaltyY = (pitchHeight - penaltyHeight) / 2;

    // Left penalty area
    pitch
      .append('rect')
      .attr('x', offsetX)
      .attr('y', offsetY + penaltyY)
      .attr('width', penaltyWidth)
      .attr('height', penaltyHeight)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Right penalty area
    pitch
      .append('rect')
      .attr('x', offsetX + pitchWidth - penaltyWidth)
      .attr('y', offsetY + penaltyY)
      .attr('width', penaltyWidth)
      .attr('height', penaltyHeight)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Prepare network data
    const players: any[] = [];
    const links: any[] = [];

    // Calculate player positions (simplified - in production, use actual position data)
    const playerSet = new Set<string>();
    network.forEach((edge: any) => {
      playerSet.add(edge.assister);
      playerSet.add(edge.shooter);
    });

    const playerArray = Array.from(playerSet);
    const formations = {
      3: [[pitchWidth * 0.15, pitchHeight * 0.5]],
      4: [
        [pitchWidth * 0.25, pitchHeight * 0.2],
        [pitchWidth * 0.25, pitchHeight * 0.5],
        [pitchWidth * 0.25, pitchHeight * 0.8],
      ],
      3: [
        [pitchWidth * 0.5, pitchHeight * 0.3],
        [pitchWidth * 0.5, pitchHeight * 0.7],
      ],
      3: [
        [pitchWidth * 0.75, pitchHeight * 0.2],
        [pitchWidth * 0.75, pitchHeight * 0.5],
        [pitchWidth * 0.75, pitchHeight * 0.8],
      ],
    };

    // Position players in a 4-3-3 formation
    playerArray.forEach((playerName, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const x = offsetX + pitchWidth * 0.2 + (row * pitchWidth * 0.25);
      const y = offsetY + pitchHeight * 0.2 + (col * pitchHeight * 0.3);

      const playerPasses = network.filter(
        (n: any) => n.assister === playerName || n.shooter === playerName
      ).length;

      players.push({
        id: playerName,
        name: playerName,
        x,
        y,
        passes: playerPasses,
      });
    });

    // Create links
    network.forEach((edge: any) => {
      const source = players.find((p) => p.id === edge.assister);
      const target = players.find((p) => p.id === edge.shooter);

      if (source && target) {
        links.push({
          source,
          target,
          count: edge.assistsCount,
          xg: edge.totalXgAssisted,
        });
      }
    });

    // Draw links (passes)
    const linkGroup = svg.append('g').attr('class', 'links');

    links.forEach((link) => {
      const thickness = Math.max(1, Math.min(8, link.count * 2));
      const opacity = Math.min(0.8, link.count * 0.2);

      linkGroup
        .append('line')
        .attr('x1', link.source.x)
        .attr('y1', link.source.y)
        .attr('x2', link.target.x)
        .attr('y2', link.target.y)
        .attr('stroke', '#F59E0B')
        .attr('stroke-width', thickness)
        .attr('stroke-opacity', opacity)
        .attr('marker-end', 'url(#arrow)');
    });

    // Add arrow marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#F59E0B');

    // Draw player nodes
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    players.forEach((player) => {
      const radius = Math.max(12, Math.min(25, 12 + player.passes * 1.5));

      const node = nodeGroup.append('g').attr('class', 'player-node');

      node
        .append('circle')
        .attr('cx', player.x)
        .attr('cy', player.y)
        .attr('r', radius)
        .attr('fill', '#EF0107')
        .attr('stroke', '#fff')
        .attr('stroke-width', 3)
        .style('cursor', 'pointer')
        .on('mouseover', function () {
          d3.select(this).attr('fill', '#FF4444').attr('r', radius + 3);
        })
        .on('mouseout', function () {
          d3.select(this).attr('fill', '#EF0107').attr('r', radius);
        });

      node
        .append('text')
        .attr('x', player.x)
        .attr('y', player.y - radius - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .attr('stroke', '#000')
        .attr('stroke-width', 0.5)
        .text(player.name.split(' ').pop() || player.name);
    });
  }, [network]);

  if (matchListLoading) {
    return (
      <Center py={10}>
        <Spinner size="xl" color="red.500" />
      </Center>
    );
  }

  return (
    <Box>
      <Heading size="lg" mb={6}>
        {team} Passing Network
      </Heading>

      {/* Match Selector */}
      <HStack spacing={4} mb={6}>
        <Box flex={1}>
          <Text mb={2} fontWeight="medium">
            Select Match
          </Text>
          <Select
            placeholder="Choose a match"
            value={selectedMatch}
            onChange={(e) => setSelectedMatch(e.target.value)}
            bg="rgba(255, 255, 255, 0.05)"
            size="lg"
          >
            {matches.map((match: any) => (
              <option key={match.matchId} value={match.matchId}>
                {match.matchName} - {new Date(match.matchDate).toLocaleDateString()}
              </option>
            ))}
          </Select>
        </Box>

        <Box>
          <Text mb={2} fontWeight="medium">
            View
          </Text>
          <Select
            value={venue}
            onChange={(e) => setVenue(e.target.value as 'home' | 'away')}
            bg="rgba(255, 255, 255, 0.05)"
            size="lg"
          >
            <option value="home">Home</option>
            <option value="away">Away</option>
          </Select>
        </Box>
      </HStack>

      {/* Statistics */}
      {selectedMatch && network.length > 0 && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Total Passes</StatLabel>
            <StatNumber>{totalPasses}</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Players</StatLabel>
            <StatNumber>{uniquePlayers}</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Pass Combinations</StatLabel>
            <StatNumber>{network.length}</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Goals from Assists</StatLabel>
            <StatNumber>
              {network.reduce((sum: number, n: any) => sum + n.goalsFromAssists, 0)}
            </StatNumber>
          </Stat>
        </SimpleGrid>
      )}

      {/* Passing Network Visualization */}
      <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl" mb={6}>
        <VStack spacing={4}>
          <HStack justify="space-between" width="100%">
            <Heading size="md">Pass Map</Heading>
            <HStack spacing={4}>
              <HStack>
                <Box w={4} h={4} bg="#EF0107" borderRadius="full" border="2px solid white" />
                <Text fontSize="sm">Player (size = pass volume)</Text>
              </HStack>
              <HStack>
                <Box w={8} h={1} bg="#F59E0B" />
                <Text fontSize="sm">Pass connection (thickness = frequency)</Text>
              </HStack>
            </HStack>
          </HStack>

          {networkLoading ? (
            <Center py={20}>
              <Spinner size="xl" color="red.500" />
            </Center>
          ) : network.length > 0 ? (
            <Box width="100%" overflow="auto">
              <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
            </Box>
          ) : selectedMatch ? (
            <Center py={20}>
              <Text color="gray.400">No passing network data available for this match</Text>
            </Center>
          ) : null}
        </VStack>
      </Box>

      {!selectedMatch && (
        <Center py={20}>
          <VStack spacing={2}>
            <Text fontSize="lg" fontWeight="medium" color="gray.400">
              Select a match to view the passing network
            </Text>
            <Text fontSize="sm" color="gray.500">
              Visualize player connections and pass patterns from the match
            </Text>
          </VStack>
        </Center>
      )}
    </Box>
  );
}
