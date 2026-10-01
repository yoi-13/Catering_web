import App from "@/components/App";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <App
      connected={Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
      )}
    />
  );
}
