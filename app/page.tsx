import { GameBoard } from "@/components/GameBoard";
import { currentNbaPlayersCategory } from "@/lib/categories";

export default function Home() {
  return (
    <main className="arena-shell">
      <GameBoard category={currentNbaPlayersCategory} />
    </main>
  );
}
