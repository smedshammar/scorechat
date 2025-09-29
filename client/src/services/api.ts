import io, { Socket } from 'socket.io-client';
import type { WebSocketMessage, Tournament, LeaderboardEntry } from '../types';

class ApiService {
  private socket: Socket | null = null;
  private isInitializing: boolean = false;

  initializeSocket(serverUrl?: string): Socket | null {
    // Auto-detect server URL based on environment
    if (!serverUrl) {
      serverUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : window.location.origin;
    }
    if (this.socket && this.socket.connected) {
      console.log('Reusing existing socket connection');
      return this.socket;
    }

    if (this.isInitializing && this.socket) {
      console.log('Socket initialization already in progress');
      return this.socket;
    }

    if (this.socket) {
      console.log('Cleaning up previous socket');
      this.disconnect();
    }

    console.log('Initializing new socket connection');
    this.isInitializing = true;

    try {
      this.socket = io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.isInitializing = false;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.isInitializing = false;
      });

      return this.socket;
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      this.isInitializing = false;
      return null;
    }
  }

  onMessage(callback: (message: WebSocketMessage) => void) {
    if (this.socket) {
      // Remove any existing message listeners first to prevent duplicates
      this.socket.off('message');
      this.socket.on('message', callback);
    }
  }

  async uploadAudio(audioBlob: Blob): Promise<{
    transcription: string;
    scoringUpdate: any;
    scoreEntry: any;
  }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch('/api/audio', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getActiveTournament(): Promise<Tournament> {
    const response = await fetch('/api/active-tournament');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getTournament(id: string): Promise<Tournament> {
    const response = await fetch(`/api/tournament/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getLeaderboard(tournamentId: string, round?: number | null): Promise<LeaderboardEntry[]> {
    const url = round ? `/api/tournament/${tournamentId}/leaderboard?round=${round}` : `/api/tournament/${tournamentId}/leaderboard`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getPlayerScorecard(tournamentId: string, playerId: string) {
    const response = await fetch(`/api/tournament/${tournamentId}/player/${playerId}/scorecard`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  disconnect() {
    if (this.socket) {
      // Remove all event listeners before disconnecting
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('connect_error');
      this.socket.off('message');
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const apiService = new ApiService();