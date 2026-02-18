import axios from 'axios';

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  tcn: string;
  uuid: string;
  initial_setup: string;
  fen: string;
  time_class: string;
  rules: string;
  white: {
    rating: number;
    result: string;
    username: string;
    uuid: string;
    id: number;
  };
  black: {
    rating: number;
    result: string;
    username: string;
    uuid: string;
    id: number;
  };
}

export interface ChessComProfile {
  player_id: number;
  username: string;
  name: string;
  followers: number;
  country: string;
  last_online: number;
  joined: number;
  status: string;
  is_streamer: boolean;
  verified: boolean;
  league: string;
  bio: string;
  avatar: string;
}

export interface ChessComStats {
  chess_rapid: {
    record: {
      win: number;
      loss: number;
      draw: number;
    };
    best: {
      rating: number;
      date: number;
      game: string;
    };
  };
  chess_blitz: {
    record: {
      win: number;
      loss: number;
      draw: number;
    };
    best: {
      rating: number;
      date: number;
      game: string;
    };
  };
  chess_bullet: {
    record: {
      win: number;
      loss: number;
      draw: number;
    };
    best: {
      rating: number;
      date: number;
      game: string;
    };
  };
  tactics: {
    highest: {
      rating: number;
      date: number;
    };
  };
  puzzle_rush: {
      best: {
        score: number;
      };
  };
}

export class ChessComAPI {
  private baseUrl: string = 'https://api.chess.com/pub';

  async getPlayerProfile(username: string): Promise<ChessComProfile> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player/${username}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com player profile:', error);
      throw error;
    }
  }

  async getPlayerStats(username: string): Promise<ChessComStats> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player/${username}/stats`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com player stats:', error);
      throw error;
    }
  }

  async getPlayerGames(
    username: string,
    options: {
      year?: number;
      month?: number;
      listed?: boolean;
      perPage?: number;
      date?: string;
    } = {}
  ): Promise<ChessComGame[]> {
    try {
      // Get current date for recent games
      const now = new Date();
      const currentYear = options.year || now.getFullYear();
      const currentMonth = options.month || now.getMonth() + 1;
      
      let url = `${this.baseUrl}/player/${username}/games/${currentYear}/${currentMonth.toString().padStart(2, '0')}`;
      
      const params = new URLSearchParams();
      if (options.listed !== undefined) params.append('listed', options.listed.toString());

      const response = await axios.get(
        `${url}${params.toString() ? '?' + params.toString() : ''}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        }
      );

      const games = response.data.games || [];
      
      // Sort by end_time to get most recent first
      games.sort((a: ChessComGame, b: ChessComGame) => b.end_time - a.end_time);
      
      // Limit results if perPage is specified
      if (options.perPage && games.length > options.perPage) {
        return games.slice(0, options.perPage);
      }

      return games;
    } catch (error) {
      console.error('Error fetching Chess.com player games:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Player not found or no games available');
        } else if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
      }
      
      // Try to get archives if direct month request fails
      try {
        const archivesResponse = await axios.get(
          `${this.baseUrl}/player/${username}/games/archives`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
          }
        );
        
        const archives = archivesResponse.data.archives;
        const allGames: ChessComGame[] = [];

        // Get games from most recent archive only
        if (archives && archives.length > 0) {
          const latestArchive = archives[archives.length - 1];
          const gamesResponse = await axios.get(latestArchive, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
          });
          const games = gamesResponse.data.games || [];
          
          // Sort by end_time to get most recent first
          games.sort((a: ChessComGame, b: ChessComGame) => b.end_time - a.end_time);
          
          if (options.perPage && games.length > options.perPage) {
            return games.slice(0, options.perPage);
          }
          
          return games;
        }
        
        return [];
      } catch (archiveError) {
        console.error('Error fetching Chess.com archives:', archiveError);
        throw new Error('Unable to fetch games. The player may not exist or has no public games.');
      }
    }
  }

  async getGame(gameId: string): Promise<ChessComGame> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/game/${gameId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com game:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Game not found or is private');
        } else if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout. Please check your connection.');
        }
      }
      throw error;
    }
  }

  async getGameByURL(gameUrl: string): Promise<ChessComGame> {
    try {
      const response = await axios.get(gameUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com game:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error('Game not found or is private');
        } else if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout. Please check your connection.');
        }
      }
      throw error;
    }
  }

  async getPlayerCurrentGames(username: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player/${username}/games/current`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com current games:', error);
      throw error;
    }
  }

  async getPlayerToMoveGames(username: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player/${username}/games/to-move`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com to-move games:', error);
      throw error;
    }
  }

  async getMonthlyArchives(username: string): Promise<string[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/player/${username}/games/archives`
      );
      return response.data.archives;
    } catch (error) {
      console.error('Error fetching Chess.com monthly archives:', error);
      throw error;
    }
  }

  async getClubMembers(clubId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/club/${clubId}/members`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com club members:', error);
      throw error;
    }
  }

  async getTournamentPlayers(tournamentId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/tournament/${tournamentId}/players`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com tournament players:', error);
      throw error;
    }
  }

  async getCountryPlayers(countryCode: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/country/${countryCode}/players`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com country players:', error);
      throw error;
    }
  }

  async getDailyPuzzle(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/puzzle`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com daily puzzle:', error);
      throw error;
    }
  }

  async getRandomPuzzle(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/puzzle/random`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Chess.com random puzzle:', error);
      throw error;
    }
  }

  async streamGameUpdates(gameId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/game/${gameId}/stream`,
        {
          headers: {
            'Accept': 'text/plain'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error streaming Chess.com game updates:', error);
      throw error;
    }
  }
}
