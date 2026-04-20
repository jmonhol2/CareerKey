import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function googleTextSearch(query: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY");
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.editorialSummary",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 3,
    }),
    cache: "no-store",
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`Google Text Search failed: ${rawText}`);
  }

  return JSON.parse(rawText);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyId = body.companyId as string | undefined;

    if (!companyId) {
      return NextResponse.json({ error: "Missing companyId" }, { status: 400 });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, company_name, website, domain, places_query")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const websiteDomain = extractDomain(company.website ?? null);
    const searchQuery =
    company.places_query ||
    (websiteDomain ? `${company.company_name} ${websiteDomain}` : company.company_name);

    const searchResults = await googleTextSearch(searchQuery);
    const place = searchResults?.places?.[0] ?? null;

    const website = place?.websiteUri || company.website || null;
    const domain = company.domain || extractDomain(website);
    const logoToken = process.env.LOGO_DEV_PUBLIC_KEY;
    const logoUrl =
      domain && logoToken
        ? `https://img.logo.dev/${domain}?token=${logoToken}`
        : null;

    const payload = {
      company_id: company.id,
      short_description:
        place?.editorialSummary?.text ??
        (place?.formattedAddress
          ? `${company.company_name} — ${place.formattedAddress}`
          : null),
      long_description: place?.editorialSummary?.text ?? null,
      industry: null,
      location: place?.formattedAddress ?? null,
      website,
      logo_url: logoUrl,
      rating: place?.rating ?? null,
      review_count: place?.userRatingCount ?? null,
      headquarters: null,
      company_size: null,
      hiring_types: null,
      majors: null,
      skills: null,
      external_source: "google_places+logo_dev",
      external_place_id: place?.id ?? null,
      last_refreshed_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("company_profiles")
      .upsert(payload, { onConflict: "company_id" })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: upserted,
      debug: {
        searchQuery,
        googleResults: searchResults,
        chosenPlace: place,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 }
    );
  }
}