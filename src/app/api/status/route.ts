import { json } from "@/lib/api";
import { MARKETS } from "@/lib/catalog/markets";
import { supabaseConfigured } from "@/lib/db";
import { liveDeliveryVerificationAvailable } from "@/lib/discovery";

export async function GET() {
  return json({
    store: supabaseConfigured() ? "supabase" : "local",
    auth: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    liveDeliveryVerification: liveDeliveryVerificationAvailable(),
    markets: MARKETS.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name })),
  });
}
