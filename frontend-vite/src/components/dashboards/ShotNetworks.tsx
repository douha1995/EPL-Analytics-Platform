'use client';

import { useQuery, gql } from '@apollo/client';
import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Spinner,
  Center,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Tooltip as ChakraTooltip,
  HStack,
  Badge,
  VStack,
  Icon,
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const GET_ASSIST_NETWORK = gql`
  query GetAssistNetwork($season: String!, $team: String!, $limit: Int) {
    assistNetwork(season: $season, team: $team, limit: $limit) {
      assister
      shooter
      season
      assistsCount
      goalsFromAssists
      totalXgAssisted
    }
  }
`;

interface ShotNetworksProps {
  season: string;
  team: string;
}

export default function ShotNetworks({ season, team }: ShotNetworksProps) {
  const { data, loading } = useQuery(GET_ASSIST_NETWORK, {
    variables: { season: season || '2024-25', team: team || 'Arsenal', limit: 50 },
    skip: !season || !team,
  });

  const networkRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data?.assistNetwork || !networkRef.current) return;

    const network = data.assistNetwork;
    const svg = d3.select(networkRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;
    svg.attr('width', width).attr('height', height);

    // Create graph
    const nodes: any[] = [];
    const links: any[] = [];

    network.forEach((edge: any) => {
      // Only show connections that have actual assists (goals)
      if (edge.goalsFromAssists === 0) return;
      
      if (!nodes.find((n) => n.id === edge.assister)) {
        nodes.push({ id: edge.assister, type: 'assister' });
      }
      if (!nodes.find((n) => n.id === edge.shooter)) {
        nodes.push({ id: edge.shooter, type: 'shooter' });
      }
      links.push({
        source: edge.assister,
        target: edge.shooter,
        value: edge.goalsFromAssists, // Use actual assists, not key passes
        keyPasses: edge.assistsCount,
        xg: edge.totalXgAssisted,
      });
    });

    const simulation = d3
      .forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // If no links with actual assists, show message
    if (links.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#888')
        .text('No assist partnerships with goals in this data');
      return;
    }

    const link = svg
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#48BB78')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.max(2, d.value * 3));

    const node = svg
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', 24)
      .attr('fill', '#EF0107')
      .attr('stroke', 'white')
      .attr('stroke-width', 3)
      .style('cursor', 'pointer');

    const label = svg
      .append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d: any) => d.id.split(' ').pop())
      .attr('font-size', 10)
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .attr('text-anchor', 'middle')
      .attr('dy', 4);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });

    // Add drag behavior
    node.call(
      d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );
  }, [data]);

  if (loading) {
    return (
      <Center py={10}>
        <Spinner size="xl" color="arsenal.500" />
      </Center>
    );
  }

  const network = data?.assistNetwork || [];

  if (network.length === 0) {
    return (
      <Center py={10}>
        <Text>No assist network data available for this season</Text>
      </Center>
    );
  }

  // Key Passes = shots that had an assister (pass leading to shot attempt)
  const keyPasses = network.reduce((sum: number, edge: any) => sum + edge.assistsCount, 0);
  // Actual Assists = passes that led to goals
  const actualAssists = network.reduce((sum: number, edge: any) => sum + edge.goalsFromAssists, 0);
  const totalXgAssisted = network.reduce((sum: number, edge: any) => sum + edge.totalXgAssisted, 0);
  const uniqueAssisters = new Set(network.map((edge: any) => edge.assister)).size;
  const conversionRate = keyPasses > 0 ? ((actualAssists / keyPasses) * 100).toFixed(1) : '0';

  // Top assisters - sorted by ACTUAL assists (goals), not key passes
  const assisterStats = network.reduce((acc: any, edge: any) => {
    if (!acc[edge.assister]) {
      acc[edge.assister] = { keyPasses: 0, assists: 0, xg: 0 };
    }
    acc[edge.assister].keyPasses += edge.assistsCount;
    acc[edge.assister].assists += edge.goalsFromAssists;
    acc[edge.assister].xg += edge.totalXgAssisted;
    return acc;
  }, {});

  const topAssisters = Object.entries(assisterStats)
    .map(([name, stats]: [string, any]) => ({
      name,
      assists: stats.assists,
      keyPasses: stats.keyPasses,
      xg: stats.xg,
    }))
    .sort((a: any, b: any) => b.assists - a.assists)
    .slice(0, 10);

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">
          {team} Shot & Assist Networks: {season}
        </Heading>
        <ChakraTooltip 
          label="This page shows shot-creating actions (key passes) and actual assists (passes leading to goals)"
          fontSize="sm"
        >
          <Icon as={InfoIcon} color="gray.400" cursor="help" />
        </ChakraTooltip>
      </HStack>

      {/* Main Stats - Corrected Terminology */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
          <HStack>
            <StatLabel>Assists</StatLabel>
            <ChakraTooltip label="Actual assists - passes that directly led to goals" fontSize="xs">
              <Icon as={InfoIcon} boxSize={3} color="gray.400" cursor="help" />
            </ChakraTooltip>
          </HStack>
          <StatNumber color="green.400">{actualAssists}</StatNumber>
          <StatHelpText>Goals from passes</StatHelpText>
        </Stat>
        <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
          <HStack>
            <StatLabel>Key Passes</StatLabel>
            <ChakraTooltip label="Passes that led to shot attempts (not necessarily goals)" fontSize="xs">
              <Icon as={InfoIcon} boxSize={3} color="gray.400" cursor="help" />
            </ChakraTooltip>
          </HStack>
          <StatNumber>{keyPasses}</StatNumber>
          <StatHelpText>Shot-creating actions</StatHelpText>
        </Stat>
        <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
          <HStack>
            <StatLabel>xG Assisted</StatLabel>
            <ChakraTooltip label="Total expected goals from assisted shots" fontSize="xs">
              <Icon as={InfoIcon} boxSize={3} color="gray.400" cursor="help" />
            </ChakraTooltip>
          </HStack>
          <StatNumber>{totalXgAssisted.toFixed(2)}</StatNumber>
          <StatHelpText>Expected goals created</StatHelpText>
        </Stat>
        <Stat bg="rgba(255, 255, 255, 0.05)" p={4} borderRadius="xl">
          <StatLabel>Conversion Rate</StatLabel>
          <StatNumber>{conversionRate}%</StatNumber>
          <StatHelpText>{uniqueAssisters} unique playmakers</StatHelpText>
        </Stat>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
        <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl">
          <Heading size="md" mb={4}>Assist Network Graph</Heading>
          <Box width="100%" overflow="auto">
            <svg ref={networkRef} style={{ display: 'block', margin: '0 auto' }} />
          </Box>
        </Box>

        <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl">
          <HStack mb={4}>
            <Heading size="md">Top Assisters</Heading>
            <Badge colorScheme="green">By Goals Created</Badge>
          </HStack>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={topAssisters} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <Box bg="gray.800" p={3} borderRadius="md" boxShadow="lg">
                        <Text fontWeight="bold" mb={1}>{data.name}</Text>
                        <Text color="green.400">Assists: {data.assists}</Text>
                        <Text color="gray.300">Key Passes: {data.keyPasses}</Text>
                        <Text color="yellow.400">xG Created: {data.xg.toFixed(2)}</Text>
                      </Box>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="assists" fill="#48BB78" radius={[0, 4, 4, 0]}>
                {topAssisters.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#EF0107' : '#48BB78'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </SimpleGrid>

      <Box bg="rgba(255, 255, 255, 0.05)" p={6} borderRadius="xl">
        <HStack mb={4}>
          <Heading size="md">Shot-Creating Partnerships</Heading>
          <Badge colorScheme="blue">Passer → Shooter</Badge>
        </HStack>
        <TableContainer>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Passer</Th>
                <Th>Shooter</Th>
                <Th isNumeric>
                  <ChakraTooltip label="Passes leading to shot attempts" fontSize="xs">
                    <Text cursor="help">Key Passes</Text>
                  </ChakraTooltip>
                </Th>
                <Th isNumeric>
                  <ChakraTooltip label="Passes that resulted in goals" fontSize="xs">
                    <Text cursor="help" color="green.400">Assists</Text>
                  </ChakraTooltip>
                </Th>
                <Th isNumeric>xG Created</Th>
                <Th isNumeric>Conversion</Th>
              </Tr>
            </Thead>
            <Tbody>
              {network.slice(0, 15).map((edge: any, idx: number) => {
                const conversion = edge.assistsCount > 0 
                  ? ((edge.goalsFromAssists / edge.assistsCount) * 100).toFixed(0) 
                  : '0';
                return (
                  <Tr key={idx} _hover={{ bg: 'rgba(255, 255, 255, 0.05)' }}>
                    <Td fontWeight="medium">{edge.assister}</Td>
                    <Td>{edge.shooter}</Td>
                    <Td isNumeric>{edge.assistsCount}</Td>
                    <Td isNumeric fontWeight="bold" color="green.400">{edge.goalsFromAssists}</Td>
                    <Td isNumeric>{edge.totalXgAssisted.toFixed(2)}</Td>
                    <Td isNumeric>
                      <Badge colorScheme={parseInt(conversion) >= 50 ? 'green' : parseInt(conversion) >= 25 ? 'yellow' : 'gray'}>
                        {conversion}%
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}
