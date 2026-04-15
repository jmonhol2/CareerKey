import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const resumeId = body.resumeId as string | undefined;

    if (!resumeId) {
      return NextResponse.json({ error: "Missing resumeId" }, { status: 400 });
    }

    const { data: resume, error } = await supabaseAdmin
      .from("student_resumes")
      .select("*")
      .eq("id", resumeId)
      .single();

    if (error || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    // Temporary scaffold parser.
    // Replace this later with real text extraction + AI parsing.
    const parsed = {
      display_name: "Jordan Monhollon",
      major: "Industrial Engineering",
      class_year: "Junior",
      skills: ["Lean", "Excel", "Quality", "Process Improvement"],
      bio: "Industrial engineering student interested in process improvement, quality, and operations.",
    };

    const { error: updateError } = await supabaseAdmin
      .from("student_resumes")
      .update({
        parsed_json: parsed,
      })
      .eq("id", resumeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ parsed });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
