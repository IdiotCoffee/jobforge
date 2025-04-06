import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Custom404() {
  return (
    <div className="bg-black text-gray-100 flex items-center justify-center min-h-screen">
      <div className="text-center p-6 max-w-md">
        <h1 className="text-9xl font-extrabold">404</h1>
        <h2 className="mt-4 text-2xl font-bold">Uh oh, lost in the void!</h2>
        <p className="mt-2 text-lg text-gray-400">
          Looks like you've stumbled into a black hole of the internet. We tried
          to find the page, but it evaporated into cosmic dust.
        </p>
        <Link href="/">
          <Button className="mt-6">
            Take Me Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
