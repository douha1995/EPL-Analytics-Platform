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
  StatHelpText,
  Spinner,
  Center,
  Text,
  HStack,
  Badge,
  VStack,
  Tooltip,
  IconButton,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react';
import { InfoIcon, WarningIcon } from '@chakra-ui/icons';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

const GET_MATCH_LIST = gql`
  query GetMatchList($season: String!, $team: String!) {
    matchList(season: $season, team: $team) {
      matchId
      matchName
      matchDate
    }
  }
`;

// Enhanced query to get shot data with tactical phases
const GET_MATCH_SHOTS_WITH_PHASES = gql`
  query GetMatchShots($matchId: String!, $team: String) {
    matchShots(matchId: $matchId, team: $team) {
      playerName
      assistedBy
      x
      y
      xg
      result
      tacticalPhase
      pitchZone
      playerPositionStatus
      team
    }
  }
`;

interface PassingNetworkProps {
  season: string;
  team: string;
}

interface Shot {
  playerName: string;
  assistedBy: string | null;
  x: number;
  y: number;
  xg: number;
  result: string;
  tacticalPhase: string;
  pitchZone: string;
  playerPositionStatus: string;
  team: string;
}

interface Pass {
  source: string;
  target: string;
  count: number;
  xg: number;
  phase: string;
}

// Tactical phase colors
const PHASE_COLORS = {
  low_block: '#EF4444',     // Red
  mid_block: '#F59E0B',     // Amber
  high_press: '#10B981',    // Green
  all: '#8B5CF6',           // Purple (default)
};

const PHASE_LABELS = {
  low_block: '🔴 Low Block (Defensive)',
  mid_block: '🟡 Mid Block (Transition)',
  high_press: '🟢 High Press (Attack)',
  all: '⚽ All Phases',
};

export default function PassingNetworkEnhanced({ season, team }: PassingNetworkProps) {
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const { data: matchListData, loading: matchListLoading } = useQuery(GET_MATCH_LIST, {
    variables: { season: season || '2024-25', team: team || 'Arsenal' },
    skip: !season || !team,
  });

  const { data: shotsData, loading: shotsLoading } = useQuery(GET_MATCH_SHOTS_WITH_PHASES, {
    variables: { matchId: selectedMatch, team: team },
    skip: !selectedMatch,
  });

  const matches = matchListData?.matchList || [];
  const shots: Shot[] = shotsData?.matchShots || [];

  // Build passing network from shots
  const buildPassingNetwork = (): Pass[] => {
    const passMap = new Map<string, Pass>();

    shots
      .filter((shot) => shot.assistedBy && shot.assistedBy !== 'null')
      .filter((shot) => phaseFilter === 'all' || shot.tacticalPhase === phaseFilter)
      .forEach((shot) => {
        const key = `${shot.assistedBy}->${shot.playerName}`;
        const existing = passMap.get(key);

        if (existing) {
          existing.count += 1;
          existing.xg += shot.xg;
        } else {
          passMap.set(key, {
            source: shot.assistedBy!,
            target: shot.playerName,
            count: 1,
            xg: shot.xg,
            phase: shot.tacticalPhase,
          });
        }
      });

    return Array.from(passMap.values());
  };

  const network = buildPassingNetwork();

  // Calculate statistics by phase
  const getPhaseStats = (phase: string) => {
    const phaseShots = shots.filter((s) => phase === 'all' || s.tacticalPhase === phase);
    const phasePasses = network.filter((p) => phase === 'all' || p.phase === phase);

    return {
      shots: phaseShots.length,
      passes: phasePasses.reduce((sum, p) => sum + p.count, 0),
      xg: phaseShots.reduce((sum, s) => sum + s.xg, 0),
      goals: phaseShots.filter((s) => s.result === 'Goal').length,
    };
  };

  const currentStats = getPhaseStats(phaseFilter);

  // Extract unique players
  const uniquePlayers = new Set([
    ...network.map((n) => n.source),
    ...network.map((n) => n.target),
  ]);

  // Render passing network visualization with modern pitch design
  useEffect(() => {
    if (!network || network.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 900;
    const height = 620;
    const pitchWidth = 800;
    const pitchHeight = 520;
    const offsetX = 50;
    const offsetY = 50;

    svg.attr('width', width).attr('height', height);

    // Draw modern pitch background
    const pitch = svg.append('g').attr('class', 'pitch');

    // Grass gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'grassGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#2d5a27');
    gradient.append('stop').attr('offset', '50%').attr('stop-color', '#1e4620');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#2d5a27');

    // Pitch outline with gradient
    pitch.append('rect')
      .attr('x', offsetX)
      .attr('y', offsetY)
      .attr('width', pitchWidth)
      .attr('height', pitchHeight)
      .attr('fill', 'url(#grassGradient)')
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .attr('rx', 2);

    // Grass stripes effect
    for (let i = 0; i < 8; i++) {
      pitch.append('rect')
        .attr('x', offsetX + (i * pitchWidth / 8))
        .attr('y', offsetY)
        .attr('width', pitchWidth / 8)
        .attr('height', pitchHeight)
        .attr('fill', i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)');
    }

    const lineColor = 'rgba(255, 255, 255, 0.9)';
    const lineWidth = 2;

    // Center line
    pitch.append('line')
      .attr('x1', offsetX + pitchWidth / 2)
      .attr('y1', offsetY)
      .attr('x2', offsetX + pitchWidth / 2)
      .attr('y2', offsetY + pitchHeight)
      .attr('stroke', lineColor)
      .attr('stroke-width', lineWidth);

    // Center circle
    pitch.append('circle')
      .attr('cx', offsetX + pitchWidth / 2)
      .attr('cy', offsetY + pitchHeight / 2)
      .attr('r', 55)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', lineWidth);

    // Center spot
    pitch.append('circle')
      .attr('cx', offsetX + pitchWidth / 2)
      .attr('cy', offsetY + pitchHeight / 2)
      .attr('r', 4)
      .attr('fill', lineColor);

    // Left penalty area
    const penaltyWidth = pitchWidth * 0.16;
    const penaltyHeight = pitchHeight * 0.65;
    pitch.append('rect')
      .attr('x', offsetX)
      .attr('y', offsetY + (pitchHeight - penaltyHeight) / 2)
      .attr('width', penaltyWidth)
      .attr('height', penaltyHeight)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', lineWidth);

    // Left 6-yard box
    const sixYardWidth = pitchWidth * 0.055;
    const sixYardHeight = pitchHeight * 0.35;
    pitch.append('rect')
      .attr('x', offsetX)
      .attr('y', offsetY + (pitchHeight - sixYardHeight) / 2)
      .attr('width', sixYardWidth)
      .attr('height', sixYardHeight)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', lineWidth);

    // Left goal
    pitch.append('rect')
      .attr('x', offsetX - 8)
      .attr('y', offsetY + pitchHeight / 2 - 30)
      .attr('width', 8)
      .attr('height', 60)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 3);

    // Right penalty area
    pitch.append('rect')
      .attr('x', offsetX + pitchWidth - penaltyWidth)
      .attr('y', offsetY + (pitchHeight - penaltyHeight) / 2)
      .attr('width', penaltyWidth)
      .attr('height', penaltyHeight)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', lineWidth);

    // Right 6-yard box
    pitch.append('rect')
      .attr('x', offsetX + pitchWidth - sixYardWidth)
      .attr('y', offsetY + (pitchHeight - sixYardHeight) / 2)
      .attr('width', sixYardWidth)
      .attr('height', sixYardHeight)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', lineWidth);

    // Right goal
    pitch.append('rect')
      .attr('x', offsetX + pitchWidth)
      .attr('y', offsetY + pitchHeight / 2 - 30)
      .attr('width', 8)
      .attr('height', 60)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 3);

    // Corner arcs
    const cornerRadius = 12;
    [
      { x: offsetX, y: offsetY, startAngle: 0, endAngle: 90 },
      { x: offsetX + pitchWidth, y: offsetY, startAngle: 90, endAngle: 180 },
      { x: offsetX + pitchWidth, y: offsetY + pitchHeight, startAngle: 180, endAngle: 270 },
      { x: offsetX, y: offsetY + pitchHeight, startAngle: 270, endAngle: 360 },
    ].forEach(corner => {
      pitch.append('path')
        .attr('d', d3.arc()({
          innerRadius: 0,
          outerRadius: cornerRadius,
          startAngle: (corner.startAngle * Math.PI) / 180,
          endAngle: (corner.endAngle * Math.PI) / 180,
        }))
        .attr('transform', `translate(${corner.x}, ${corner.y})`)
        .attr('fill', 'none')
        .attr('stroke', lineColor)
        .attr('stroke-width', lineWidth);
    });

    // Prepare player positions - spread across attacking half (right side of pitch)
    const playerArray = Array.from(uniquePlayers);
    const players: any[] = [];

    // Position players in a realistic formation spread
    const positions = [
      // Attacking positions (right side)
      { x: 0.85, y: 0.5 },   // Striker
      { x: 0.75, y: 0.25 },  // Right wing
      { x: 0.75, y: 0.75 },  // Left wing
      { x: 0.65, y: 0.35 },  // Right AM
      { x: 0.65, y: 0.65 },  // Left AM
      { x: 0.55, y: 0.5 },   // CAM
      { x: 0.45, y: 0.3 },   // Right CM
      { x: 0.45, y: 0.7 },   // Left CM
      { x: 0.35, y: 0.5 },   // CDM
      { x: 0.25, y: 0.2 },   // RB
      { x: 0.25, y: 0.8 },   // LB
      { x: 0.25, y: 0.5 },   // CB
    ];

    playerArray.forEach((playerName, idx) => {
      const pos = positions[idx % positions.length];
      const jitterX = (Math.random() - 0.5) * 0.08;
      const jitterY = (Math.random() - 0.5) * 0.1;
      const x = offsetX + pitchWidth * Math.min(0.92, Math.max(0.08, pos.x + jitterX));
      const y = offsetY + pitchHeight * Math.min(0.88, Math.max(0.12, pos.y + jitterY));

      const playerPasses = network.filter(
        (n) => n.source === playerName || n.target === playerName
      ).reduce((sum, p) => sum + p.count, 0);

      const playerGoals = network.filter(
        (n) => n.target === playerName
      ).reduce((sum, p) => sum + (shots.filter(s => s.playerName === playerName && s.result === 'Goal').length > 0 ? 1 : 0), 0);

      players.push({
        id: playerName,
        name: playerName,
        x,
        y,
        passes: playerPasses,
      });
    });

    // Create links with phase-based colors
    const links = network.map((pass) => {
      const source = players.find((p) => p.id === pass.source);
      const target = players.find((p) => p.id === pass.target);
      return { ...pass, source, target };
    }).filter((link) => link.source && link.target);

    // Create tooltip div
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'pass-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(20, 20, 30, 0.95)')
      .style('color', 'white')
      .style('padding', '14px 18px')
      .style('border-radius', '10px')
      .style('font-size', '13px')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('box-shadow', '0 4px 20px rgba(0,0,0,0.4)')
      .style('border', '1px solid rgba(255,255,255,0.1)');

    // Add arrow marker
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#fff')
      .attr('fill-opacity', 0.7);

    // Draw curved links (passes) with gradient colors
    const linkGroup = svg.append('g').attr('class', 'links');

    links.forEach((link, idx) => {
      const thickness = Math.max(3, Math.min(12, link.count * 3));
      const opacity = Math.min(0.85, 0.4 + link.count * 0.15);
      const phaseColor = PHASE_COLORS[link.phase as keyof typeof PHASE_COLORS] || '#F59E0B';

      // Calculate curved path
      const dx = link.target.x - link.source.x;
      const dy = link.target.y - link.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;

      linkGroup
        .append('path')
        .attr('d', `M${link.source.x},${link.source.y}A${dr},${dr} 0 0,1 ${link.target.x},${link.target.y}`)
        .attr('fill', 'none')
        .attr('stroke', phaseColor)
        .attr('stroke-width', thickness)
        .attr('stroke-opacity', opacity)
        .attr('stroke-linecap', 'round')
        .attr('marker-end', 'url(#arrow)')
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('stroke-width', thickness + 4)
            .attr('stroke-opacity', 1);

          const phaseName = link.phase ? link.phase.replace('_', ' ').toUpperCase() : 'UNKNOWN';

          tooltip
            .html(`
              <div style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 8px;">
                <strong style="font-size: 14px;">${link.source.name} → ${link.target.name}</strong>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${phaseColor};"></span>
                <span style="color: ${phaseColor};">${phaseName}</span>
              </div>
              <div>Key Passes: <strong>${link.count}</strong></div>
              <div>xG Created: <strong>${link.xg.toFixed(2)}</strong></div>
            `)
            .style('visibility', 'visible');
        })
        .on('mousemove', function (event) {
          tooltip
            .style('top', event.pageY - 10 + 'px')
            .style('left', event.pageX + 15 + 'px');
        })
        .on('mouseout', function () {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('stroke-width', thickness)
            .attr('stroke-opacity', opacity);

          tooltip.style('visibility', 'hidden');
        });
    });

    // Draw player nodes with modern styling
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    // Add drop shadow filter
    const filter = defs.append('filter')
      .attr('id', 'dropShadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 2)
      .attr('stdDeviation', 3)
      .attr('flood-opacity', 0.4);

    players.forEach((player) => {
      const radius = Math.max(18, Math.min(30, 18 + player.passes * 1.5));

      const node = nodeGroup.append('g').attr('class', 'player-node');

      // Outer glow
      node.append('circle')
        .attr('cx', player.x)
        .attr('cy', player.y)
        .attr('r', radius + 4)
        .attr('fill', 'rgba(239, 1, 7, 0.3)')
        .attr('filter', 'url(#dropShadow)');

      // Main circle
      node.append('circle')
        .attr('cx', player.x)
        .attr('cy', player.y)
        .attr('r', radius)
        .attr('fill', '#EF0107')
        .attr('stroke', '#fff')
        .attr('stroke-width', 3)
        .style('cursor', 'pointer')
        .on('mouseover', function () {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill', '#FF3333')
            .attr('r', radius + 5);
        })
        .on('mouseout', function () {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill', '#EF0107')
            .attr('r', radius);
        });

      // Player name with background
      const lastName = player.name.split(' ').pop() || player.name;
      node.append('text')
        .attr('x', player.x)
        .attr('y', player.y - radius - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .attr('paint-order', 'stroke')
        .attr('stroke', 'rgba(0,0,0,0.8)')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .text(lastName);

      // Pass count inside circle
      node.append('text')
        .attr('x', player.x)
        .attr('y', player.y + 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('font-weight', 'bold')
        .attr('fill', '#fff')
        .text(player.passes);
    });

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [network, phaseFilter, uniquePlayers]);

  if (matchListLoading) {
    return (
      <Center py={10}>
        <Spinner size="xl" color="red.500" />
      </Center>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box>
        <HStack justify="space-between" mb={4}>
          <VStack align="start" spacing={1}>
            <Heading size="lg">{team} Shot Creation Network</Heading>
            <Text fontSize="sm" color="gray.400">
              Visualizes key passes leading to shot attempts
            </Text>
          </VStack>
          <Tooltip
            label="This shows key passes (passes leading to shots), not all passing. Color indicates the tactical phase when the shot-creating pass was made."
            fontSize="sm"
            maxW="300px"
          >
            <IconButton
              aria-label="Info"
              icon={<InfoIcon />}
              size="sm"
              colorScheme="blue"
              variant="ghost"
            />
          </Tooltip>
        </HStack>
        
        <Alert status="info" variant="subtle" mb={6} borderRadius="lg" bg="rgba(66, 153, 225, 0.1)">
          <AlertIcon />
          <AlertDescription fontSize="sm">
            This network shows <strong>shot-creating passes</strong> (key passes that led to shots), not all passing data.
            Line thickness indicates frequency, colors represent tactical phase.
          </AlertDescription>
        </Alert>

        {/* Match & Phase Selectors */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={6}>
          <Box>
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
              Tactical Phase Filter
            </Text>
            <Select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              bg="rgba(255, 255, 255, 0.05)"
              size="lg"
            >
              <option value="all">{PHASE_LABELS.all}</option>
              <option value="low_block">{PHASE_LABELS.low_block}</option>
              <option value="mid_block">{PHASE_LABELS.mid_block}</option>
              <option value="high_press">{PHASE_LABELS.high_press}</option>
            </Select>
          </Box>
        </SimpleGrid>

        {/* Phase-based Statistics */}
        {selectedMatch && shots.length > 0 && (
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4} mb={6}>
            <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
              <StatLabel>Total Shots</StatLabel>
              <StatNumber>{currentStats.shots}</StatNumber>
              <StatHelpText>In this match</StatHelpText>
            </Stat>
            <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
              <StatLabel>Key Passes</StatLabel>
              <StatNumber>{currentStats.passes}</StatNumber>
              <StatHelpText>Led to shots</StatHelpText>
            </Stat>
            <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
              <StatLabel>Partnerships</StatLabel>
              <StatNumber>{network.length}</StatNumber>
              <StatHelpText>Unique combos</StatHelpText>
            </Stat>
            <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
              <StatLabel>xG Created</StatLabel>
              <StatNumber>{currentStats.xg.toFixed(2)}</StatNumber>
              <StatHelpText>Expected goals</StatHelpText>
            </Stat>
            <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
              <StatLabel>Goals</StatLabel>
              <StatNumber color="green.400">{currentStats.goals}</StatNumber>
              <StatHelpText>Actual goals</StatHelpText>
            </Stat>
          </SimpleGrid>
        )}

        {/* Shot Creation Network Visualization */}
        <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl" mb={6}>
          <VStack spacing={4}>
            <HStack justify="space-between" width="100%" flexWrap="wrap" gap={4}>
              <VStack align="start" spacing={0}>
                <Heading size="md">Shot Creation Map</Heading>
                <Text fontSize="xs" color="gray.500">Players who created shots via key passes</Text>
              </VStack>
              <HStack spacing={4} fontSize="sm" flexWrap="wrap">
                <HStack>
                  <Box w={3} h={3} bg={PHASE_COLORS.low_block} borderRadius="full" />
                  <Text fontSize="xs">Low Block</Text>
                </HStack>
                <HStack>
                  <Box w={3} h={3} bg={PHASE_COLORS.mid_block} borderRadius="full" />
                  <Text fontSize="xs">Mid Block</Text>
                </HStack>
                <HStack>
                  <Box w={3} h={3} bg={PHASE_COLORS.high_press} borderRadius="full" />
                  <Text fontSize="xs">High Press</Text>
                </HStack>
              </HStack>
            </HStack>

            {shotsLoading ? (
              <Center py={20}>
                <Spinner size="xl" color="red.500" />
              </Center>
            ) : network.length > 0 ? (
              <Box width="100%" overflow="auto" bg="rgba(0,0,0,0.2)" borderRadius="lg" p={2}>
                <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
              </Box>
            ) : selectedMatch ? (
              <Center py={20}>
                <VStack>
                  <Text color="gray.400">
                    No shot creation data available
                    {phaseFilter !== 'all' && ' for this tactical phase'}
                  </Text>
                  {phaseFilter !== 'all' && (
                    <Text fontSize="sm" color="gray.500">
                      Try selecting "All Phases" to see all shot-creating combinations
                    </Text>
                  )}
                </VStack>
              </Center>
            ) : null}
          </VStack>
        </Box>

        {!selectedMatch && (
          <Center py={20}>
            <VStack spacing={3}>
              <Box fontSize="4xl">⚽</Box>
              <Text fontSize="lg" fontWeight="medium" color="gray.400">
                Select a match to view shot creation patterns
              </Text>
              <Text fontSize="sm" color="gray.500" textAlign="center" maxW="400px">
                Analyze which players combine to create shots and from which tactical phases
              </Text>
            </VStack>
          </Center>
        )}
      </Box>
    </motion.div>
  );
}
