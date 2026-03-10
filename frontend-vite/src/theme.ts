import { extendTheme } from '@chakra-ui/react';

export const theme = extendTheme({
  colors: {
    // Premier League brand colors
    epl: {
      50: '#f0e6ff',
      100: '#d4b3ff',
      200: '#b880ff',
      300: '#9c4dff',
      400: '#801aff',
      500: '#37003C', // Premier League Purple
      600: '#2d0031',
      700: '#230026',
      800: '#19001b',
      900: '#0f0010',
    },
    cyan: {
      50: '#e6ffff',
      100: '#b3ffff',
      200: '#80ffff',
      300: '#4dffff',
      400: '#1affff',
      500: '#04F5FF', // Premier League Cyan
      600: '#03c4cc',
      700: '#029399',
      800: '#016266',
      900: '#013133',
    },
    // Keep some accent colors for specific teams
    arsenal: {
      500: '#EF0107',
    },
    chelsea: {
      500: '#034694',
    },
    liverpool: {
      500: '#C8102E',
    },
    mancity: {
      500: '#6CABDD',
    },
  },
  fonts: {
    heading: `'Inter', 'Roboto', system-ui, -apple-system, sans-serif`,
    body: `'Inter', 'Roboto', system-ui, -apple-system, sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: 'linear-gradient(135deg, #000000 0%, #37003C 30%, #001F3F 70%, #000000 100%)',
        bgAttachment: 'fixed',
        color: 'white',
        minHeight: '100vh',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(55, 0, 60, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(4, 245, 255, 0.15) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        },
      },
      '#root': {
        position: 'relative',
        zIndex: 1,
      },
      '*::placeholder': {
        color: 'gray.400',
      },
      '*': {
        scrollbarWidth: 'thin',
        scrollbarColor: '#04F5FF #37003C',
      },
      '*::-webkit-scrollbar': {
        width: '10px',
        height: '10px',
      },
      '*::-webkit-scrollbar-track': {
        background: 'rgba(55, 0, 60, 0.3)',
        borderRadius: '5px',
      },
      '*::-webkit-scrollbar-thumb': {
        background: 'linear-gradient(180deg, #37003C 0%, #04F5FF 100%)',
        borderRadius: '5px',
        border: '2px solid rgba(255, 255, 255, 0.1)',
      },
      '*::-webkit-scrollbar-thumb:hover': {
        background: 'linear-gradient(180deg, #04F5FF 0%, #37003C 100%)',
      },
      '@keyframes shimmer': {
        '0%': {
          transform: 'translateX(-100%)',
        },
        '100%': {
          transform: 'translateX(100%)',
        },
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'epl',
      },
      variants: {
        solid: {
          bg: 'linear-gradient(135deg, #37003C 0%, #04F5FF 100%)',
          color: 'white',
          fontWeight: 'bold',
          _hover: {
            bg: 'linear-gradient(135deg, #04F5FF 0%, #37003C 100%)',
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 30px rgba(4, 245, 255, 0.4)',
          },
          _active: {
            transform: 'translateY(0px)',
          },
          transition: 'all 0.3s ease',
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          borderRadius: 'xl',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.3s ease',
          _hover: {
            transform: 'translateY(-4px)',
            boxShadow: '0 16px 48px rgba(4, 245, 255, 0.2), 0 0 0 1px rgba(4, 245, 255, 0.1)',
            border: '1px solid rgba(4, 245, 255, 0.3)',
          },
        },
      },
    },
    Tabs: {
      variants: {
        line: {
          tab: {
            color: 'gray.300',
            borderColor: 'transparent',
            bg: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(5px)',
            borderRadius: 'lg',
            mr: 2,
            mb: 2,
            px: 4,
            py: 2,
            fontWeight: 'semibold',
            transition: 'all 0.3s ease',
            _hover: {
              color: 'white',
              bg: 'rgba(4, 245, 255, 0.15)',
              transform: 'translateY(-2px)',
              borderBottom: '2px solid rgba(4, 245, 255, 0.5)',
            },
            _selected: {
              color: 'white',
              bg: 'linear-gradient(135deg, rgba(55, 0, 60, 0.6) 0%, rgba(4, 245, 255, 0.3) 100%)',
              borderColor: 'transparent',
              borderBottom: '3px solid #04F5FF',
              boxShadow: '0 4px 20px rgba(4, 245, 255, 0.3)',
              transform: 'translateY(-2px)',
            },
          },
          tablist: {
            borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
            pb: 2,
          },
          tabpanel: {
            p: 6,
          },
        },
      },
    },
    Stat: {
      baseStyle: {
        container: {
          bg: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: 'xl',
          p: 4,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s ease',
          _hover: {
            transform: 'scale(1.05)',
            boxShadow: '0 8px 32px rgba(4, 245, 255, 0.2)',
            border: '1px solid rgba(4, 245, 255, 0.3)',
          },
        },
        label: {
          color: 'gray.300',
          fontSize: 'sm',
          fontWeight: 'medium',
          textTransform: 'uppercase',
          letterSpacing: 'wide',
        },
        number: {
          color: 'white',
          fontSize: '2xl',
          fontWeight: 'bold',
          bgGradient: 'linear(to-r, white, cyan.500)',
          bgClip: 'text',
        },
        helpText: {
          color: 'gray.400',
          fontSize: 'xs',
        },
      },
    },
  },
});
