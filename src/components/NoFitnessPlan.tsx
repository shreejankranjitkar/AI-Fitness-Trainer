import Link from "next/link";
import { ArrowRight, Dumbbell } from "lucide-react";
import { Button } from "./ui/button";

const NoFitnessPlan = () => {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm sm:px-8">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#e6f5f2] text-[#078f8b]">
        <Dumbbell className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-xl font-bold text-[#172536]">No fitness plans yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Create a personalized fitness and diet plan to get started. Your saved plans will appear here.
      </p>
      <Button
        size="lg"
        asChild
        className="mt-6 rounded-xl bg-[#078f8b] px-6 text-white hover:bg-[#067b78]"
      >
        <Link href="/generate-program">
          Create your first plan
          <ArrowRight className="ml-2 size-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
};

export default NoFitnessPlan;
