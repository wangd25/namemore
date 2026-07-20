import { notFound } from "next/navigation";

import { RoomLobby } from "@/components/RoomLobby";
import { normalizeRoomCode } from "@/lib/room-contract";

export default async function RoomLobbyPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const roomCode = normalizeRoomCode((await params).roomCode);
  if (!roomCode) notFound();
  return <main className="arena-shell room-screen"><RoomLobby roomCode={roomCode} /></main>;
}
