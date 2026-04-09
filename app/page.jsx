'use client';

import CollectionTracker from "./components/CollectionTracker";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl flex-col gap-8 py-12 px-6">
        <h1 className="text-3xl font-bold text-center self-center text-zinc-900 dark:text-white">
          Cabal{" "}
          <a
            href="https://www.neogames.online/"
            className="text-blue-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            Neo
          </a> - {" "}
          Coleção Helper
          <Image
            src="/ale.png"
            alt="Cabal Neo Logo"
            className="inline px-2"
            width={100}
            height={100}
            priority
          />
        </h1>

        <CollectionTracker />
      </main>
    </div>
  );
}