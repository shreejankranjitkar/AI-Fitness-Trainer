import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dumbbell,
  Sparkles,
  Users,
  CalendarDays,
  AppleIcon,
} from "lucide-react";
import { USER_PROGRAMS } from "@/constants";

const UserPrograms = () => {
  return (
    <section className="relative w-full border-t border-[#e5e2dc] bg-[#f5f7f6] pb-20 pt-14 sm:pt-16">
      <div className="container mx-auto max-w-6xl px-4">
        {/* HEADER- PROGRAM GALLERY */}
        <div className="mb-10 overflow-hidden rounded-2xl border border-[#e1e7e5] bg-white shadow-[0_8px_30px_rgba(22,43,57,0.04)] sm:mb-12">
          {/* HEADER BAR */}
          <div className="flex items-center justify-between border-b border-[#e8eceb] bg-[#fbfdfc] px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="size-2.5 rounded-full bg-[#078f8b]"></div>
              <span className="text-sm font-semibold text-[#087f7b]">
                Program Gallery
              </span>
            </div>
            <div className="text-sm text-[#687381]">Sample plans</div>
          </div>

          {/* HEADER CONTENT */}
          <div className="px-5 py-8 text-center sm:p-9">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#152131] sm:text-4xl">
              Sample fitness programs
            </h2>

            <p className="mx-auto max-w-xl text-base leading-7 text-[#596474] sm:text-lg">
              Preview example workout and nutrition plans.
            </p>
          </div>
        </div>

        {/* Program cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {USER_PROGRAMS.map((program) => (
            <Card
              key={program.id}
              className="overflow-hidden rounded-2xl border border-[#e1e7e5] bg-white text-[#152131] shadow-[0_8px_30px_rgba(22,43,57,0.04)] transition hover:-translate-y-1 hover:border-[#8dcac4] hover:shadow-[0_14px_34px_rgba(22,43,57,0.08)]"
            >
              {/* Card header with user info */}
              <div className="flex items-center justify-between border-b border-[#e8eceb] bg-[#fbfdfc] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-[#078f8b]"></div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#087f7b]">
                    Sample {program.id}
                  </span>
                </div>
                <div className="text-xs font-medium text-[#687381]">
                  {program.fitness_level.toUpperCase()}
                </div>
              </div>

              <CardHeader className="pt-6 px-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-[#e1e7e5]">
                    <img
                      src={program.profilePic}
                      alt={`${program.first_name}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-[#152131]">
                      {program.first_name}
                    </CardTitle>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[#687381]">
                      <Users className="h-4 w-4 text-[#078f8b]" />
                      {program.age}y • {program.workout_days}d/week
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-2 rounded-full border border-[#cde8e3] bg-[#edf8f5] px-3 py-1 text-sm text-[#087f7b]">
                    <Sparkles className="h-4 w-4" />
                    {program.fitness_goal}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#687381]">
                    <CalendarDays className="h-4 w-4 text-[#078f8b]" />
                    {program.workout_days} days / week
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5">
                {/* Program details */}
                <div className="space-y-5 pt-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-[#edf8f5] p-2 text-[#078f8b]">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-[#152131]">
                          {program.workout_plan.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-[#687381]">
                        {program.equipment_access}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-[#edf8f5] p-2 text-[#078f8b]">
                      <AppleIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-[#152131]">
                          {program.diet_plan.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm text-[#687381]">
                        Nutrition overview for this sample plan
                      </p>
                    </div>
                  </div>
                </div>

                {/* Program description */}
                <div className="mt-5 border-t border-[#e8eceb] pt-5">
                  <div className="text-sm leading-6 text-[#596474]">
                    <span className="text-[#078f8b]">&gt; </span>
                    {program.workout_plan.description.substring(0, 120)}...
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA section */}
        <div className="mt-16 text-center">
          <Link href="/generate-program">
            <Button
              size="lg"
              className="rounded-full bg-[#078f8b] px-8 py-6 text-lg text-white hover:bg-[#067b78]"
            >
              Generate Your Program
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default UserPrograms;
