import apiClient from "./apiClient";

export const getDashboardData = async () => {
  try {
    const [videosRes, platformsRes] = await Promise.all([
      apiClient.get('/videos?page=1&limit=10'),
      apiClient.get('/platforms')
    ]);

    console.log("[getDashboardData] API responses:", {
      videos: videosRes.data,
      platforms: platformsRes.data
    });

    // Backend returns { data: [...], total, page, limit }
    const videos = videosRes.data.data || (Array.isArray(videosRes.data) ? videosRes.data : []);
    // Backend returns { success, connected, platforms: string[], accountCount }
    const connectedPlatforms = platformsRes.data.accountCount 
      ?? (Array.isArray(platformsRes.data.platforms) ? platformsRes.data.platforms.length : 0);
    
    // Function to get number of clips for a video
    const getClipsCount = (video: any) => {
      if (typeof video.clipsCount === 'number') return video.clipsCount;
      if (Array.isArray(video.clips)) return video.clips.length;
      return 0;
    };
    
    // Count total clips across all videos
    const totalClips = videos.reduce((acc: number, video: any) => acc + getClipsCount(video), 0);

    return {
      stats: {
        clips: totalClips.toString(),
        platforms: connectedPlatforms.toString(),
      },
      projects: videos.slice(0, 6).map((video: any) => ({
        id: video.id,
        title: video.title || "Untitled Video",
        clipsCount: getClipsCount(video),
        status: video.status || "completed",
        thumbnail: video.thumbnail || null,
      })),
      totalVideos: videosRes.data.total || videos.length,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    throw error;
  }
};

export const getVideos = async (page = 1, limit = 10) => {
  const response = await apiClient.get(`/videos?page=${page}&limit=${limit}`);
  
  // Function to get number of clips for a video
  const getClipsCount = (video: any) => {
    if (typeof video.clipsCount === 'number') return video.clipsCount;
    if (Array.isArray(video.clips)) return video.clips.length;
    return 0;
  };
  
  const rawItems = response.data.data || (Array.isArray(response.data) ? response.data : []);
  
  // Process each video to ensure clipsCount is set
  const items = rawItems.map((video: any) => ({
    ...video,
    clipsCount: getClipsCount(video)
  }));

  return {
    items,
    total: response.data.total || 0,
  };
};

export const getProjectsData = async (videoId?: string, page = 1, limit = 20) => {
  try {
    let endpoint: string;
    
    // First, try GET /videos/:id to see if it returns clips directly
    if (videoId) {
      try {
        const videoRes = await apiClient.get(`/videos/${videoId}`);
        console.log("[getProjectsData] GET /videos/:id response:", videoRes.data);
        
        // If video has clips directly, use those
        if (videoRes.data?.clips && Array.isArray(videoRes.data.clips) && videoRes.data.clips.length > 0) {
          const clips = videoRes.data.clips;
          return clips.map((clip: any) => ({
            id: String(clip.id),
            title: clip.title || `Clip #${clip.id}`,
            thumbnail: clip.thumbnail || null,
            score: clip.viralScore ?? clip.score ?? 0,
            scoreKey: (clip.viralScore ?? clip.score ?? 0) >= 80 ? "high" : (clip.viralScore ?? clip.score ?? 0) >= 50 ? "medium" : "low",
            duration: clip.duration ? formatDuration(clip.duration) : "00:00",
            style: clip.platform || clip.style || "General",
            clipUrl: clip.clipUrl || null,
          }));
        }
      } catch (err) {
        console.log("[getProjectsData] GET /videos/:id failed, trying next approach:", err);
      }
    }
    
    // If that fails, try the original endpoints
    endpoint = videoId 
      ? `/videos/${videoId}/clips?page=${page}&limit=${limit}` 
      : `/clips?page=${page}&limit=${limit}`;
      
    const response = await apiClient.get(endpoint);
    console.log("[getProjectsData] API response:", response.data);
    // Backend returns { data: [...], total, page, limit } or plain array
    const clips = response.data.data || (Array.isArray(response.data) ? response.data : []);

    return clips.map((clip: any) => ({
      id: String(clip.id),
      title: clip.title || `Clip #${clip.id}`,
      thumbnail: clip.thumbnail || null,
      score: clip.viralScore ?? clip.score ?? 0,
      scoreKey: (clip.viralScore ?? clip.score ?? 0) >= 80 ? "high" : (clip.viralScore ?? clip.score ?? 0) >= 50 ? "medium" : "low",
      duration: clip.duration ? formatDuration(clip.duration) : "00:00",
      style: clip.platform || clip.style || "General",
      clipUrl: clip.clipUrl || null,
    }));
  } catch (error) {
    console.error("Failed to fetch projects data:", error);
    throw error;
  }
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export const deleteClip = async (id: string) => {
  await apiClient.delete(`/clips/${id}`);
};

export const getClipById = async (id: string) => {
  const response = await apiClient.get(`/clips/${id}`);
  return response.data;
};

export const createClip = async (data: any) => {
  const response = await apiClient.post(`/clips`, data);
  return response.data;
};

export const updateClip = async (id: string, data: any) => {
  const response = await apiClient.patch(`/clips/${id}`, data);
  return response.data;
};

// ─── Clip Info (public, no auth) ──────────────────────────────────────────────

export interface ClipInfo {
  id: number;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  duration: number | null;
  platform: string | null;
  createdAt: string;
  tippingEnabled: boolean;
  owner: {
    id: number;
    name: string | null;
    username: string | null;
    /** BNB wallet address (0x…) */
    bnbAddress: string | null;
    walletConnected: boolean;
  };
  bnbProof?: {
    txHash: string;
    blockNumber: number;
    timestamp: string;
    contractAddress: string;
  } | null;
}

export const getClipInfo = async (id: string): Promise<ClipInfo> => {
  const response = await apiClient.get(`/clips/${id}/info`);
  return response.data;
};

// ─── Clip Download (Tip-Gated) ─────────────────────────────────────────────────
// Pass senderAddress (the tipper's BNB wallet) so the backend can look up
// confirmed tips by address — no JWT required on this endpoint.

export const getClipDownloadUrl = async (id: string, senderAddress?: string) => {
  const params = senderAddress ? { senderAddress } : {};
  const response = await apiClient.get(`/clips/${id}/download`, { params });
  return response.data;
};

// ─── Public Feed ───────────────────────────────────────────────────────────────

export const getPublicFeed = async (page = 1, limit = 20) => {
  const response = await apiClient.get(`/clips/feed?page=${page}&limit=${limit}`);
  const clips = response.data.data || (Array.isArray(response.data) ? response.data : []);
  return {
    items: clips.map((clip: any) => ({
      id: String(clip.id),
      title: clip.title || `Clip #${clip.id}`,
      thumbnail: clip.thumbnail || null,
      duration: clip.duration ? formatDuration(clip.duration) : "00:00",
      clipUrl: clip.clipUrl || null,
      creatorAddress: clip.creatorAddress || null,
      creatorName: clip.creatorName || null,
      createdAt: clip.createdAt || null,
    })),
    total: response.data.total || clips.length,
  };
};

// ─── Earnings Dashboard ─────────────────────────────────────────────────────────

export const getEarningsData = async () => {
  const response = await apiClient.get('/dashboard/earnings');
  return response.data;
};

// ─── Upload Progress SSE ───────────────────────────────────────────────────────

export const getUploadProgressUrl = (userId: string, videoId: string) => {
  return `/api/sse/events/upload-progress/${userId}/${videoId}`;
};

// ─── Platform Disconnect ─────────────────────────────────────────────────────────

export const disconnectPlatform = async (platform: string) => {
  await apiClient.delete(`/platforms/${platform}`);
};

// ─── Post Clip to Platforms ────────────────────────────────────────────────────

export const postClipToPlatforms = async (clipId: string, platforms: string[]) => {
  const response = await apiClient.post('/platforms/post-clip', {
    clipId,
    platforms,
  });
  return response.data;
};

// ─── BNB Auth ────────────────────────────────────────────────────────────────

/**
 * GET /auth/bnb/challenge?bnbAddress=0x…
 * Returns { nonce, message } — the message is what the user signs.
 */
export const getBnbChallenge = async (bnbAddress: string) => {
  const response = await apiClient.get('/auth/bnb/challenge', {
    params: { bnbAddress },
  });
  return response.data as { nonce: string; message: string };
};

/**
 * POST /auth/bnb/login  { bnbAddress, nonce, signature }
 * Login or signup with BNB wallet.
 * Returns { user, redirect? }
 */
export const loginWithBnb = async (
  bnbAddress: string,
  nonce: string,
  signature: string
) => {
  const response = await apiClient.post('/auth/bnb/login', {
    bnbAddress,
    nonce,
    signature,
  });
  return response.data;
};

/**
 * GET /auth/bnb/connect/challenge
 * Returns { nonce, message } for connecting a BNB wallet to an existing account.
 */
export const getBnbConnectChallenge = async (bnbAddress: string) => {
  const response = await apiClient.get('/auth/bnb/connect/challenge', {
    params: { bnbAddress },
  });
  return response.data as { nonce: string; message: string };
};

/**
 * POST /auth/bnb/connect  { bnbAddress, nonce, signature }
 * Links a BNB wallet to an existing (email/Google) account.
 */
export const connectBnbWallet = async (
  bnbAddress: string,
  nonce: string,
  signature: string
) => {
  const response = await apiClient.post('/auth/bnb/connect', {
    bnbAddress,
    nonce,
    signature,
  });
  return response.data;
};

/**
 * DELETE /auth/bnb/disconnect
 * Unlinks the BNB wallet from the current account.
 */
export const disconnectBnbWallet = async () => {
  await apiClient.delete('/auth/bnb/disconnect');
};

// ─── BNB Proof of Creation ────────────────────────────────────────────────────

export interface BnbProof {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  contractAddress: string;
}

/**
 * POST /bnb/proof/:clipId
 * Dispatches a BNB proof-of-creation anchoring job for the clip.
 */
export const dispatchBnbProof = async (clipId: string) => {
  const response = await apiClient.post(`/bnb/proof/${clipId}`);
  return response.data as { jobId: string };
};

/**
 * GET /clips/:id/bnb-proof
 * Returns the on-chain proof once anchored.
 */
export const getBnbProof = async (clipId: string) => {
  const response = await apiClient.get(`/clips/${clipId}/bnb-proof`);
  return response.data as BnbProof | null;
};

// ─── BNB Tips ─────────────────────────────────────────────────────────────────

export interface BuildBnbTipResult {
  /** To address (creator's BNB wallet) */
  to: string;
  /** Value in wei (hex string) */
  value: string;
  /** Gas limit (hex string) */
  gas?: string;
  /** Chain ID */
  chainId?: number;
  /** Optional data field for smart contract tips */
  data?: string;
}

/**
 * POST /bnb/tips/build  { clipId, amount, senderAddress }
 * Backend builds and returns the unsigned BNB transaction parameters.
 * The frontend passes these directly to MetaMask for signing + broadcasting.
 */
export const buildBnbTip = async (
  clipId: number,
  amount: string,
  senderAddress: string
): Promise<BuildBnbTipResult> => {
  const response = await apiClient.post('/bnb/tips/build', {
    clipId,
    amount,
    senderAddress,
  });
  return response.data;
};

/**
 * POST /bnb/tips/submit  { clipId, signedTxHex, senderAddress }
 * After MetaMask signs, submit the tx hash / signed hex to the backend
 * so it can track the tip and unlock the download.
 */
export const submitBnbTip = async (
  clipId: number,
  signedTxHex: string,
  senderAddress: string
) => {
  const response = await apiClient.post('/bnb/tips/submit', {
    clipId,
    signedTxHex,
    senderAddress,
  });
  return response.data;
};

// ─── Agent Marketplace ────────────────────────────────────────────────────────

export interface Agent {
  /** Numeric ID returned by the backend */
  id: number;
  name: string;
  description: string;
  /**
   * Price per job in BNB — the backend field is `pricePerJobBNB` (e.g. "0.01").
   * Normalised to `pricePerJobBNB` everywhere; the old `price` alias is kept for
   * backward-compat display helpers only.
   */
  pricePerJobBNB: string;
  /** Wallet address that owns / operates this agent */
  walletAddress?: string;
  /** On-chain escrow contract address */
  contractAddress?: string;
  /** Number of jobs processed */
  jobsProcessed?: number;
  /** Average rating 0–5 */
  rating?: number;
  /** Agent capabilities / tags */
  capabilities?: string[];
  status?: "active" | "inactive";
}

export interface AgentJob {
  id: string;
  agentId: string;
  videoUrl: string;
  style?: string;
  clientAddress: string;
  status: "queued" | "processing" | "completed" | "failed";
  /** On-chain job ID from the escrow contract */
  contractJobId?: string;
  /** Transaction hash of the escrow payment */
  txHash?: string;
  /**
   * The backend video ID once processing starts.
   * Used to redirect to /dashboard/processing?videoId= for SSE progress.
   */
  videoId?: string;
  /**
   * Clip IDs returned when status is COMPLETED.
   * The backend returns these as `resultClipIds` — use GET /clips/:id for each.
   */
  resultClipIds?: string[];
  /** Inline clip objects (populated client-side from resultClipIds) */
  clips?: Array<{
    id: string;
    title: string;
    thumbnail: string | null;
    clipUrl: string | null;
    viralScore: number;
    duration: number;
    platform: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
}

export interface CreateAgentJobDto {
  videoUrl: string;
  style?: string;
  clientAddress: string;
  contractJobId?: string;
  txHash?: string;
}

/**
 * GET /agents
 * Returns all registered AI agents on the marketplace.
 * Normalises the backend shape so consumers always see `pricePerJobBNB`.
 */
export const getAgents = async (): Promise<Agent[]> => {
  const response = await apiClient.get('/agents');
  const raw: any[] = Array.isArray(response.data)
    ? response.data
    : response.data?.data ?? [];

  return raw.map((a) => ({
    ...a,
    id: Number(a.id),
    // Backend field is pricePerJobBNB; accept either spelling
    pricePerJobBNB: a.pricePerJobBNB ?? a.price ?? "0",
  }));
};

/**
 * GET /agents/:id
 * Returns a single agent by ID.
 */
export const getAgent = async (id: number): Promise<Agent> => {
  const response = await apiClient.get(`/agents/${id}`);
  const a = response.data;
  return {
    ...a,
    id: Number(a.id),
    pricePerJobBNB: a.pricePerJobBNB ?? a.price ?? "0",
  };
};

/**
 * POST /agent/jobs  { videoUrl, style, clientAddress, contractJobId?, txHash? }
 * Creates a new agent job.
 */
export const createAgentJob = async (data: CreateAgentJobDto): Promise<AgentJob> => {
  const response = await apiClient.post('/agent/jobs', data);
  return response.data;
};

/**
 * GET /agent/jobs
 * Lists the current user's recent agent jobs.
 */
export const getAgentJobs = async (): Promise<AgentJob[]> => {
  const response = await apiClient.get('/agent/jobs');
  return Array.isArray(response.data)
    ? response.data
    : response.data?.data ?? [];
};

/**
 * GET /agent/jobs/:jobId
 * Returns the status and result clips for a specific job.
 * If the job is COMPLETED and has resultClipIds, fetches each clip individually.
 */
export const getAgentJob = async (jobId: string): Promise<AgentJob> => {
  const response = await apiClient.get(`/agent/jobs/${jobId}`);
  const job: AgentJob = response.data;

  // If completed with resultClipIds but no inline clips array, fetch each clip
  if (
    job.resultClipIds &&
    job.resultClipIds.length > 0 &&
    (!job.clips || job.clips.length === 0)
  ) {
    try {
      const clips = await Promise.all(
        job.resultClipIds.map(async (clipId) => {
          const res = await apiClient.get(`/clips/${clipId}`);
          const c = res.data;
          return {
            id: String(c.id),
            title: c.title || `Clip #${c.id}`,
            thumbnail: c.thumbnail || null,
            clipUrl: c.clipUrl || null,
            viralScore: c.viralScore ?? c.score ?? 0,
            duration: c.duration ?? 0,
            platform: c.platform || "General",
          };
        })
      );
      job.clips = clips;
    } catch {
      // Clip fetch failed — job still shows as completed, just without inline clips
    }
  }

  return job;
};

// ─── Change Password ────────────────────────────────────────────────────────────

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await apiClient.patch('/users/me/password', {
    currentPassword,
    newPassword,
  });
  return response.data;
};

// ─── Delete Video ───────────────────────────────────────────────────────────────

export const deleteVideo = async (videoId: string) => {
  await apiClient.delete(`/videos/${videoId}`);
};

// ─── Update Video ──────────────────────────────────────────────────────────────

export const updateVideo = async (videoId: string, data: any) => {
  const response = await apiClient.patch(`/videos/${videoId}`, data);
  return response.data;
};
