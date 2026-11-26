import UserPrograms from "@/components/UserPrograms";
import { Button } from "@/components/ui/button";
import { Apple, ArrowRight, ClipboardCheck, Mic2, Target } from "lucide-react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const highlights = [
  {
    icon: ClipboardCheck,
    title: "Personalized plans",
    description: "Workout and nutrition plans shaped around your goals.",
  },
  {
    icon: Mic2,
    title: "AI voice coaching",
    description: "Talk through your goals with your AI fitness coach.",
  },
  {
    icon: Apple,
    title: "Nutrition guidance",
    description: "Get meal ideas that fit your preferences and routine.",
  },
];

const steps = [
  {
    number: "1",
    title: "Tell us your goals",
    description: "Share what you want to achieve.",
  },
  {
    number: "2",
    title: "Talk with your AI coach",
    description: "Discuss your needs and preferences.",
  },
  {
    number: "3",
    title: "Follow your plan",
    description: "Use your personalized workout and meal plan.",
  },
];

const HomePage = async () => {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="-mt-24 flex min-h-screen flex-col overflow-hidden bg-[#fbf9f5] text-[#152131]">
      <section className="relative isolate flex w-full flex-1 items-center pt-28 pb-12 sm:pt-32 lg:min-h-[500px] lg:pt-28 lg:pb-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_45%,rgba(16,151,145,0.09),transparent_45%)]" />
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:gap-0 lg:px-12">
          <div className="relative z-10 max-w-[690px] pb-4 lg:py-10">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#e5f4f1] px-3 py-1.5 text-sm font-semibold text-[#087f7b]">
              <Target className="size-4" aria-hidden="true" />
              Your personal AI fitness coach
            </p>
            <h1 className="max-w-[690px] text-[2.8rem] font-bold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-[4.4rem]">
              Your fitness journey,
              <br className="hidden sm:block" />
              <span className="text-[#078f8b]"> intelligently guided.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#4a5666] sm:text-xl">
              Get personalized workout and nutrition plans with an AI fitness coach.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-13 rounded-full bg-[#078f8b] px-7 text-base font-semibold text-white shadow-[0_8px_20px_rgba(7,143,139,0.2)] hover:bg-[#067b78]"
              >
                <Link href="/generate-program" className="inline-flex items-center">
                  Get started <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                variant="outline"
                className="h-13 rounded-full border-[#9ca5ad] bg-white/70 px-7 text-base font-semibold text-[#152131] hover:bg-white"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>

          <div className="relative -mx-5 h-[300px] overflow-hidden sm:-mx-8 sm:h-[390px] lg:absolute lg:inset-y-0 lg:right-[min(0px,calc((1440px-100vw)/2))] lg:mx-0 lg:h-full lg:w-[54%]">
            <img
              src="/landing-hero.png"
              alt="Athlete strength training in a gym"
              className="h-full w-full object-cover object-[54%_42%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#fbf9f5] via-[#fbf9f5]/35 to-transparent lg:from-[#fbf9f5] lg:via-[#fbf9f5]/15" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#fbf9f5]/60 to-transparent" />
          </div>
        </div>
      </section>

      <section aria-label="AI FITNESS TRAINER features" className="border-y border-[#e5e2dc] bg-white/75">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-[#e5e2dc] px-5 py-2 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-12">
          {highlights.map(({ icon: Icon, title, description }) => (
            <article key={title} className="flex items-center gap-5 px-4 py-6 sm:px-7 md:py-7">
              <Icon className="size-10 shrink-0 text-[#078f8b]" strokeWidth={1.7} aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                <p className="mt-1 text-sm leading-5 text-[#596474]">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mb-9 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-[#078f8b]" />
        </div>
        <div className="grid grid-cols-1 gap-7 md:grid-cols-3 md:gap-5">
          {steps.map((step, index) => (
            <article key={step.number} className="relative flex items-start gap-4 px-2 sm:px-5">
              {index < steps.length - 1 && (
                <div className="absolute left-[58px] right-[-4px] top-5 hidden h-px bg-[#d8d9d5] md:block" />
              )}
              <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#d8f0eb] text-lg font-bold text-[#087f7b]">
                {step.number}
              </span>
              <div className="relative z-10 bg-[#fbf9f5] pr-3">
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#596474]">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <UserPrograms />
    </div>
  );
};

export default HomePage;
