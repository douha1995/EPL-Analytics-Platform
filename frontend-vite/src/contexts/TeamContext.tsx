import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, gql } from '@apollo/client';

const GET_TEAMS = gql`
  query GetTeams {
    teams {
      name
      seasonsCount
      totalMatches
    }
  }
`;

interface Team {
  name: string;
  seasonsCount: number;
  totalMatches: number;
}

interface TeamContextType {
  team: string;
  setTeam: (team: string) => void;
  availableTeams: Team[];
  isLoading: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

interface TeamProviderProps {
  children: ReactNode;
}

export function TeamProvider({ children }: TeamProviderProps) {
  // Default to Arsenal for backward compatibility
  const [team, setTeamState] = useState<string>('Arsenal');

  // Fetch available teams from GraphQL
  const { data, loading } = useQuery(GET_TEAMS);

  const availableTeams = data?.teams || [];

  // Persist team selection to localStorage
  useEffect(() => {
    const savedTeam = localStorage.getItem('selectedTeam');
    if (savedTeam && availableTeams.some((t: Team) => t.name === savedTeam)) {
      setTeamState(savedTeam);
    }
  }, [availableTeams]);

  const setTeam = (newTeam: string) => {
    setTeamState(newTeam);
    localStorage.setItem('selectedTeam', newTeam);
  };

  const value = {
    team,
    setTeam,
    availableTeams,
    isLoading: loading,
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}
