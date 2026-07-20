"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RoomGamePlayer } from "@/lib/room-types";

export type TypingLengthBucket = 0 | 1 | 2 | 3;
export type RoomTypingSignal = { typing: boolean; lengthBucket: TypingLengthBucket };
export type RoomRealtimeState = "connecting" | "connected" | "degraded";

export type RoomRealtimeConnection = {
  sendTyping(signal: RoomTypingSignal): Promise<void>;
  announceBoardChange(): Promise<void>;
  destroy(): Promise<void>;
};

export function getTypingLengthBucket(length: number): TypingLengthBucket {
  if (length <= 0) return 0;
  if (length <= 3) return 1;
  if (length <= 8) return 2;
  return 3;
}

export function buildTypingSignal(value: string): RoomTypingSignal {
  const length = value.trim().length;
  return { typing: length > 0, lengthBucket: getTypingLengthBucket(length) };
}

export function parseTypingSignal(value: unknown): RoomTypingSignal | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== "lengthBucket,typing") return null;
  if (typeof record.typing !== "boolean" || !Number.isInteger(record.lengthBucket)) return null;
  const bucket = record.lengthBucket as number;
  if (bucket < 0 || bucket > 3 || (!record.typing && bucket !== 0)) return null;
  return { typing: record.typing, lengthBucket: bucket as TypingLengthBucket };
}

export function roomPlayerTopic(roomCode: string, playerId: string): string {
  return `room:${roomCode}:player:${playerId}`;
}

export async function connectRoomRealtime({
  roomCode,
  players,
  currentPlayerId,
  onPresence,
  onTyping,
  onBoardChanged,
  onState,
}: {
  roomCode: string;
  players: readonly RoomGamePlayer[];
  currentPlayerId: string;
  onPresence(playerId: string, connected: boolean): void;
  onTyping(playerId: string, signal: RoomTypingSignal): void;
  onBoardChanged(playerId: string): void;
  onState(state: RoomRealtimeState): void;
}): Promise<RoomRealtimeConnection> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);

  const channels: RealtimeChannel[] = [];
  let ownChannel: RealtimeChannel | null = null;
  let destroyed = false;
  let connectedChannels = 0;
  onState("connecting");

  for (const player of players) {
    const channel = supabase.channel(roomPlayerTopic(roomCode, player.id), {
      config: {
        private: true,
        broadcast: { ack: true, self: false },
        presence: { key: currentPlayerId },
      },
    });
    channels.push(channel);
    if (player.id === currentPlayerId) ownChannel = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        onPresence(player.id, Object.keys(channel.presenceState()).length > 0);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const signal = parseTypingSignal(payload);
        if (signal) onTyping(player.id, signal);
      })
      .on("broadcast", { event: "board_changed" }, () => onBoardChanged(player.id))
      .subscribe(async (status) => {
        if (destroyed) return;
        if (status === "SUBSCRIBED") {
          connectedChannels += 1;
          if (player.id === currentPlayerId) await channel.track({ online: true });
          if (connectedChannels === channels.length) onState("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          onState("degraded");
        }
      });
  }

  return {
    async sendTyping(signal) {
      if (!ownChannel || destroyed) return;
      await ownChannel.send({ type: "broadcast", event: "typing", payload: signal });
    },
    async announceBoardChange() {
      if (!ownChannel || destroyed) return;
      await ownChannel.send({ type: "broadcast", event: "board_changed", payload: {} });
    },
    async destroy() {
      destroyed = true;
      if (ownChannel) await ownChannel.untrack();
      await Promise.all(channels.map((channel) => supabase.removeChannel(channel)));
    },
  };
}
