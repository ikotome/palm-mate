interface StackChanResponse {
  success: boolean;
  message?: string;
  expression?: string;
}

class StackChanService {
  private baseUrl: string = 'http://stackchan.local';
  private fallbackUrl: string = 'http://192.168.1.100'; // 固定IPのフォールバック
  private isConnected: boolean = false;
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    await this.checkConnection();
    this.startPeriodicUpdates();
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  private async checkConnection(): Promise<void> {
    try {
      // まずstackchan.localを試す
      const response = await this.fetchWithTimeout(`${this.baseUrl}/status`, {
        method: 'GET'
      }, 3000);
      
      if (response.ok) {
        this.isConnected = true;
        console.log('StackChan connected via stackchan.local');
        return;
      }
    } catch (error) {
      console.log('stackchan.local not reachable, trying fallback...');
    }

    try {
      // フォールバックIPを試す
      const response = await this.fetchWithTimeout(`${this.fallbackUrl}/status`, {
        method: 'GET'
      }, 3000);
      
      if (response.ok) {
        this.baseUrl = this.fallbackUrl;
        this.isConnected = true;
        console.log('StackChan connected via fallback IP');
        return;
      }
    } catch (error) {
      console.log('StackChan not available, continuing without device connection');
    }

    this.isConnected = false;
  }

  async updateExpression(taskCompletionRate: number): Promise<StackChanResponse> {
    if (!this.isConnected) {
      return { success: false, message: 'StackChan not connected' };
    }

    try {
      let expression = 'neutral';
      
      if (taskCompletionRate >= 0.8) {
        expression = 'happy';
      } else if (taskCompletionRate >= 0.5) {
        expression = 'satisfied';
      } else if (taskCompletionRate >= 0.2) {
        expression = 'neutral';
      } else {
        expression = 'encouraging';
      }

      const response = await this.fetchWithTimeout(`${this.baseUrl}/expression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expression: expression,
          duration: 3000 // 3秒間表示
        })
      }, 5000);

      if (response.ok) {
        const data = await response.json();
        return { success: true, expression, message: data.message };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('StackChan expression update failed:', error);
      this.isConnected = false;
      return { success: false, message: 'Update failed' };
    }
  }

  async sendNightlyNotification(journalContent: string): Promise<StackChanResponse> {
    if (!this.isConnected) {
      return { success: false, message: 'StackChan not connected' };
    }

    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'お疲れ様でした！今日も一日頑張りましたね。ゆっくり休んでください。',
          volume: 0.7
        })
      }, 10000);

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: data.message };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('StackChan notification failed:', error);
      this.isConnected = false;
      return { success: false, message: 'Notification failed' };
    }
  }

  async moveAndGreet(): Promise<StackChanResponse> {
    if (!this.isConnected) {
      return { success: false, message: 'StackChan not connected' };
    }

    try {
      // 動きのコマンドを送信
      const moveResponse = await this.fetchWithTimeout(`${this.baseUrl}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'wave',
          duration: 2000
        })
      }, 5000);

      if (moveResponse.ok) {
        // 少し待ってから挨拶
        setTimeout(async () => {
          await fetch(`${this.baseUrl}/speak`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: 'おはようございます！今日も一緒に頑張りましょう！',
              volume: 0.8
            })
          });
        }, 1000);

        return { success: true, message: 'Greeting completed' };
      } else {
        throw new Error(`HTTP ${moveResponse.status}`);
      }
    } catch (error) {
      console.error('StackChan greeting failed:', error);
      this.isConnected = false;
      return { success: false, message: 'Greeting failed' };
    }
  }

  private startPeriodicUpdates(): void {
    // 3分ごとに表情更新をチェック
    this.updateInterval = setInterval(async () => {
      if (!this.isConnected) {
        await this.checkConnection();
        return;
      }

      // 現在の進捗を取得して表情更新
      // この部分は実際のアプリケーション状態と連携する必要がある
      try {
        const response = await this.fetchWithTimeout(`${this.baseUrl}/ping`, {
          method: 'GET'
        }, 3000);
        
        if (!response.ok) {
          this.isConnected = false;
        }
      } catch (error) {
        this.isConnected = false;
        console.log('StackChan connection lost, will retry...');
      }
    }, 180000); // 3分 = 180,000ms
  }

  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async reconnect(): Promise<void> {
    await this.checkConnection();
  }
}

export default new StackChanService();
