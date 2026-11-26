import SignInSessionTasks from "@/components/auth/SignInSessionTasks";

type SignInTasksPageProps = {
  searchParams: Promise<{ returnTo?: string | string[]; redirect_url?: string | string[] }>;
};

export default async function SignInTasksPage({ searchParams }: SignInTasksPageProps) {
  const { returnTo, redirect_url: redirectUrl } = await searchParams;
  const returnToValue = Array.isArray(returnTo)
    ? returnTo[0] ?? null
    : returnTo ?? (Array.isArray(redirectUrl) ? redirectUrl[0] ?? null : redirectUrl ?? null);

  return <SignInSessionTasks returnTo={returnToValue} />;
}
