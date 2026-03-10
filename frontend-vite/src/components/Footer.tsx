'use client';

import { Box, Container, Text, Link, HStack, VStack, Flex } from '@chakra-ui/react';

export default function Footer() {
  return (
    <Box
      bg="rgba(0, 0, 0, 0.6)"
      backdropFilter="blur(20px)"
      borderTop="2px solid rgba(4, 245, 255, 0.2)"
      py={8}
      mt={12}
      position="relative"
      _before={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent, #37003C, #04F5FF, #37003C, transparent)',
      }}
    >
      <Container maxW="container.xl">
        <VStack spacing={4}>
          <Flex justify="center" align="center" gap={3} flexWrap="wrap">
            <Text
              fontSize="sm"
              color="white"
              fontWeight="bold"
              bgGradient="linear(to-r, #37003C, #04F5FF)"
              bgClip="text"
            >
              ⚽ EPL Analytics Platform
            </Text>
            <Text fontSize="sm" color="gray.500">
              •
            </Text>
            <Text fontSize="xs" color="gray.400" fontWeight="semibold">
              Premier League Statistical Analysis
            </Text>
          </Flex>

          <HStack justify="center" spacing={4} flexWrap="wrap">
            <Text fontSize="xs" color="gray.400">
              Data powered by{' '}
              <Link
                href="https://understat.com"
                isExternal
                color="cyan.500"
                fontWeight="semibold"
                _hover={{
                  color: 'cyan.300',
                  textDecoration: 'underline',
                }}
                transition="all 0.3s ease"
              >
                Understat
              </Link>{' '}
              &{' '}
              <Link
                href="https://fbref.com"
                isExternal
                color="cyan.500"
                fontWeight="semibold"
                _hover={{
                  color: 'cyan.300',
                  textDecoration: 'underline',
                }}
                transition="all 0.3s ease"
              >
                FBref
              </Link>
            </Text>
            <Text fontSize="xs" color="gray.500">
              •
            </Text>
            <Text fontSize="xs" color="gray.400">
              AI powered by{' '}
              <Link
                href="https://ollama.com"
                isExternal
                color="cyan.500"
                fontWeight="semibold"
                _hover={{
                  color: 'cyan.300',
                  textDecoration: 'underline',
                }}
              >
                Ollama
              </Link>
            </Text>
          </HStack>

          <Text fontSize="xs" color="gray.500" fontWeight="medium">
            Analyzing Arsenal • Manchester United • Manchester City • Liverpool
          </Text>

          <Text fontSize="xs" color="gray.600">
            © 2026 EPL Analytics. Advanced Football Intelligence Platform.
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
