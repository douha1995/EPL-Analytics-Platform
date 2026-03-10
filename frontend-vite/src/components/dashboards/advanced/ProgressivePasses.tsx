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
  VStack,
  Badge,
  RangeSlider,
  RangeSliderTrack,
  RangeSliderFilledTrack,
  RangeSliderThumb,
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

const GET_MATCH_SHOTS = gql`
  query GetMatchShots($matchId: String!, $team: String) {
    matchShots(matchId: $matchId, team: $team) {
      x
      y
      xg
      result
      playerName
      minute
      team
    }
  }
`;

interface ProgressivePassesProps {
  season: string;
  team: string;
}

interface Pass {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  player: string;
  minute: number;
  distance: number;
  progression: number;
}

export default function ProgressivePasses({ season, team }: ProgressivePassesProps) {
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [minProgression, setMinProgression] = useState([10, 50]);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: matchListData, loading: matchListLoading } = useQuery(GET_MATCH_LIST, {
    variables: { season: season || '2024-25', team: team || 'Arsenal' },
    skip: !season || !team,
  });

  const { data: shotsData, loading: shotsLoading } = useQuery(GET_MATCH_SHOTS, {
    variables: { matchId: selectedMatch, team: team },
    skip: !selectedMatch,
  });

  const matches = matchListData?.matchList || [];
  const shots = shotsData?.matchShots || [];

  // Generate synthetic progressive passes from shot data
  // In production, this would come from actual pass data
  const generateProgressivePasses = (): Pass[] => {
    const passes: Pass[] = [];

    shots.forEach((shot: any, idx: number) => {
      if (idx > 0 && idx < shots.length - 1) {
        const prevShot = shots[idx - 1];

        // Calculate progression (forward movement)
        const xProgression = (shot.x - prevShot.x) * 100;

        // Only include passes that move forward significantly
        if (xProgression > 5) {
          const distance = Math.sqrt(
            Math.pow(shot.x - prevShot.x, 2) + Math.pow(shot.y - prevShot.y, 2)
          ) * 100;

          passes.push({
            x1: prevShot.x,
            y1: prevShot.y,
            x2: shot.x,
            y2: shot.y,
            player: shot.playerName,
            minute: shot.minute,
            distance,
            progression: xProgression,
          });
        }
      }
    });

    return passes;
  };

  const allPasses = generateProgressivePasses();
  const filteredPasses = allPasses.filter(
    (p) => p.progression >= minProgression[0] && p.progression <= minProgression[1]
  );

  const avgProgression = filteredPasses.length > 0
    ? filteredPasses.reduce((sum, p) => sum + p.progression, 0) / filteredPasses.length
    : 0;

  const totalDistance = filteredPasses.reduce((sum, p) => sum + p.distance, 0);

  // Render progressive passes visualization
  useEffect(() => {
    if (!filteredPasses || filteredPasses.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 900;
    const height = 600;
    const pitchWidth = 800;
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
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,5');

    // Thirds lines (to show progression zones)
    [1/3, 2/3].forEach((fraction) => {
      pitch
        .append('line')
        .attr('x1', offsetX + pitchWidth * fraction)
        .attr('y1', offsetY)
        .attr('x2', offsetX + pitchWidth * fraction)
        .attr('y2', offsetY + pitchHeight)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.3)
        .attr('stroke-dasharray', '3,3');
    });

    // Zone labels
    const zones = [
      { x: pitchWidth * 0.15, label: 'Defensive' },
      { x: pitchWidth * 0.5, label: 'Middle' },
      { x: pitchWidth * 0.85, label: 'Attacking' },
    ];

    zones.forEach((zone) => {
      pitch
        .append('text')
        .attr('x', offsetX + zone.x)
        .attr('y', offsetY - 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', '#fff')
        .attr('opacity', 0.6)
        .text(zone.label + ' Third');
    });

    // Arrow marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow-progressive')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#F59E0B');

    // Draw passes
    const passGroup = svg.append('g').attr('class', 'passes');

    filteredPasses.forEach((pass) => {
      const x1 = offsetX + pass.x1 * pitchWidth;
      const y1 = offsetY + pass.y1 * pitchHeight;
      const x2 = offsetX + pass.x2 * pitchWidth;
      const y2 = offsetY + pass.y2 * pitchHeight;

      // Color based on progression distance
      const progressionRatio = Math.min(pass.progression / 50, 1);
      const color = d3.interpolateRgb('#10B981', '#EF0107')(progressionRatio);

      // Draw arrow
      const arrow = passGroup.append('g').attr('class', 'pass-arrow');

      arrow
        .append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('stroke-opacity', 0.7)
        .attr('marker-end', 'url(#arrow-progressive)')
        .on('mouseover', function () {
          d3.select(this).attr('stroke-width', 4).attr('stroke-opacity', 1);
        })
        .on('mouseout', function () {
          d3.select(this).attr('stroke-width', 2.5).attr('stroke-opacity', 0.7);
        });

      // Start point
      arrow
        .append('circle')
        .attr('cx', x1)
        .attr('cy', y1)
        .attr('r', 4)
        .attr('fill', color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
    });

  }, [filteredPasses]);

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
        {team} Progressive Passes
      </Heading>

      {/* Match Selector */}
      <Box mb={6}>
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

      {/* Progression Filter */}
      {selectedMatch && (
        <Box mb={6} bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
          <Text mb={3} fontWeight="medium">
            Filter by Progression Distance: {minProgression[0]}m - {minProgression[1]}m
          </Text>
          <RangeSlider
            min={0}
            max={70}
            step={5}
            value={minProgression}
            onChange={(val) => setMinProgression(val)}
            colorScheme="red"
          >
            <RangeSliderTrack>
              <RangeSliderFilledTrack />
            </RangeSliderTrack>
            <RangeSliderThumb index={0} />
            <RangeSliderThumb index={1} />
          </RangeSlider>
        </Box>
      )}

      {/* Statistics */}
      {selectedMatch && filteredPasses.length > 0 && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Progressive Passes</StatLabel>
            <StatNumber>{filteredPasses.length}</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Avg Progression</StatLabel>
            <StatNumber>{avgProgression.toFixed(1)}m</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Total Distance</StatLabel>
            <StatNumber>{totalDistance.toFixed(0)}m</StatNumber>
          </Stat>
          <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
            <StatLabel>Longest Pass</StatLabel>
            <StatNumber>
              {Math.max(...filteredPasses.map((p) => p.progression)).toFixed(1)}m
            </StatNumber>
          </Stat>
        </SimpleGrid>
      )}

      {/* Progressive Passes Visualization */}
      <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl" mb={6}>
        <VStack spacing={4}>
          <HStack justify="space-between" width="100%">
            <Heading size="md">Pass Progression Map</Heading>
            <HStack spacing={6} fontSize="sm">
              <HStack>
                <Box w={12} h={3}>
                  <svg width="48" height="12">
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#EF0107" />
                      </linearGradient>
                    </defs>
                    <rect width="48" height="12" fill="url(#progressGradient)" />
                  </svg>
                </Box>
                <Text>Short → Long progression</Text>
              </HStack>
            </HStack>
          </HStack>

          {shotsLoading ? (
            <Center py={20}>
              <Spinner size="xl" color="red.500" />
            </Center>
          ) : filteredPasses.length > 0 ? (
            <Box width="100%" overflow="auto">
              <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
            </Box>
          ) : selectedMatch ? (
            <Center py={20}>
              <Text color="gray.400">
                No progressive passes found for selected filter criteria
              </Text>
            </Center>
          ) : null}

          <Text fontSize="sm" color="gray.400" textAlign="center">
            Arrows show direction and distance of forward passes. Color intensity indicates
            progression length.
          </Text>
        </VStack>
      </Box>

      {!selectedMatch && (
        <Center py={20}>
          <VStack spacing={2}>
            <Text fontSize="lg" fontWeight="medium" color="gray.400">
              Select a match to view progressive passes
            </Text>
            <Text fontSize="sm" color="gray.500">
              Analyze forward ball progression and attacking build-up play
            </Text>
          </VStack>
        </Center>
      )}
    </Box>
  );
}
