import {
  Select,
  FormControl,
  FormLabel,
  Box,
  Text,
  Flex,
  Badge,
} from '@chakra-ui/react';
import { useTeam } from '../contexts/TeamContext';

export default function TeamSelector() {
  const { team, setTeam, availableTeams, isLoading } = useTeam();

  if (isLoading) {
    return (
      <Box>
        <Text fontSize="sm" color="gray.400">Loading teams...</Text>
      </Box>
    );
  }

  return (
    <FormControl minW="200px" maxW="300px">
      <FormLabel
        fontSize="sm"
        color="gray.300"
        mb={1}
        fontWeight="medium"
      >
        Select Team
      </FormLabel>
      <Select
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        size="md"
        bg="rgba(255, 255, 255, 0.05)"
        backdropFilter="blur(10px)"
        border="1px solid rgba(255, 255, 255, 0.1)"
        color="white"
        fontWeight="bold"
        borderRadius="md"
        _hover={{
          bg: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'arsenal.500',
        }}
        _focus={{
          borderColor: 'arsenal.500',
          boxShadow: '0 0 0 1px #EF0107',
        }}
      >
        {availableTeams.map((t) => (
          <option
            key={t.name}
            value={t.name}
            style={{
              backgroundColor: '#001F3F',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            {t.name} ({t.totalMatches} matches)
          </option>
        ))}
      </Select>
      {team && (
        <Flex mt={2} gap={2} flexWrap="wrap">
          <Badge
            colorScheme="green"
            fontSize="xs"
            px={2}
            py={1}
            borderRadius="md"
          >
            {availableTeams.find(t => t.name === team)?.seasonsCount || 0} seasons
          </Badge>
          <Badge
            colorScheme="blue"
            fontSize="xs"
            px={2}
            py={1}
            borderRadius="md"
          >
            {availableTeams.find(t => t.name === team)?.totalMatches || 0} matches
          </Badge>
        </Flex>
      )}
    </FormControl>
  );
}
