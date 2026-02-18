import axios from 'axios';

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  perf: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  players: {
    white: {
      user: {
        name: string;
        title?: string;
      };
      rating: number;
      ratingDiff?: number;
    };
    black: {
      user: {
        name: string;
        title?: string;
      };
      rating: number;
      ratingDiff?: number;
    };
  };
  opening: {
    eco: string;
    name: string;
    ply: number;
  };
  moves: string;
  pgn: string;
  clock?: {
    initial: number;
    increment: number;
  };
}

export interface LichessUser {
  id: string;
  username: string;
  perfs: {
    [key: string]: {
      rating: number;
      games: number;
      rd: number;
      prog: number;
    };
  };
  createdAt: number;
  seenAt: number;
  profile: {
    country: string;
    location: string;
    bio: string;
    firstName: string;
    lastName: string;
    fideRating: number;
    links: string[];
  };
}

export class LichessAPI {
  private baseUrl: string = 'https://lichess.org/api';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private getHeaders() {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  async getUser(username: string): Promise<LichessUser> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/user/${username}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Lichess user:', error);
      throw error;
    }
  }

  async getUserGames(
    username: string, 
    options: {
      max?: number;
      rated?: boolean;
      perfType?: string[];
      color?: 'white' | 'black';
      opening?: boolean;
      since?: number;
      until?: number;
    } = {}
  ): Promise<LichessGame[]> {
    try {
      const params = new URLSearchParams();
      
      if (options.max) params.append('max', options.max.toString());
      if (options.rated !== undefined) params.append('rated', options.rated.toString());
      if (options.perfType) params.append('perfType', options.perfType.join(','));
      if (options.color) params.append('color', options.color);
      if (options.opening) params.append('opening', 'true');
      if (options.since) params.append('since', options.since.toString());
      if (options.until) params.append('until', options.until.toString());

      const response = await axios.get(
        `${this.baseUrl}/games/user/${username}?${params.toString()}`,
        { 
          headers: this.getHeaders(),
          responseType: 'text'
        }
      );

      // Lichess returns NDJSON, parse it
      const games = response.data
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => JSON.parse(line));

      return games;
    } catch (error) {
      console.error('Error fetching Lichess games:', error);
      throw error;
    }
  }

  async getGame(gameId: string): Promise<LichessGame> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/game/export/${gameId}`,
        { 
          headers: this.getHeaders(),
          params: {
            evals: true,
            clocks: true,
            opening: true
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Lichess game:', error);
      throw error;
    }
  }

  async getGameAnalysis(gameId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/game/export/${gameId}`,
        { 
          headers: this.getHeaders(),
          params: {
            evals: true,
            clocks: true,
            opening: true,
            literate: true
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Lichess game analysis:', error);
      throw error;
    }
  }

  async getOpeningExplorer(
    fen: string,
    options: {
      variant?: string;
      speeds?: string[];
      ratings?: string[];
      timeControls?: string[];
      recentGames?: number;
    } = {}
  ) {
    try {
      const params = new URLSearchParams();
      params.append('fen', fen);
      
      if (options.variant) params.append('variant', options.variant);
      if (options.speeds) params.append('speeds', options.speeds.join(','));
      if (options.ratings) params.append('ratings', options.ratings.join(','));
      if (options.timeControls) params.append('timeControls', options.timeControls.join(','));
      if (options.recentGames) params.append('recentGames', options.recentGames.toString());

      const response = await axios.get(
        `${this.baseUrl}/opening-explorer/player?${params.toString()}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching opening explorer data:', error);
      throw error;
    }
  }

  async getMasterOpeningExplorer(
    fen: string,
    options: {
      variant?: string;
      recentGames?: number;
    } = {}
  ) {
    try {
      const params = new URLSearchParams();
      params.append('fen', fen);
      
      if (options.variant) params.append('variant', options.variant);
      if (options.recentGames) params.append('recentGames', options.recentGames.toString());

      const response = await axios.get(
        `${this.baseUrl}/opening-explorer/masters?${params.toString()}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching master opening explorer data:', error);
      throw error;
    }
  }

  async getCloudEvaluation(fen: string, variant: string = 'standard'): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/cloud-eval`,
        {
          headers: this.getHeaders(),
          params: {
            fen,
            variant,
            multiPv: 3
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching cloud evaluation:', error);
      throw error;
    }
  }
}
