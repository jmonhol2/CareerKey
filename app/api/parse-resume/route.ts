import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import OpenAI from "openai";
import mammoth from "mammoth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLikelyGpa(text: string): number | null {
  const match = text.match(/\bGPA[:\s]*([0-4]\.\d{1,2})\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractLikelyMajor(text: string): string | null {
  const majors = [
    "Industrial Engineering",
    "Mechanical Engineering",
    "Electrical Engineering",
    "Computer Science",
    "Business Analytics",
    "Supply Chain",
    "Systems Engineering",
    "Civil Engineering",
    "Chemical Engineering",
  ];

  const lower = text.toLowerCase();
  const found = majors.find((m) => lower.includes(m.toLowerCase()));
  return found ?? null;
}

function extractLikelyClassYear(text: string): string | null {
  const lower = text.toLowerCase();

  if (lower.includes("freshman")) return "Freshman";
  if (lower.includes("sophomore")) return "Sophomore";
  if (lower.includes("junior")) return "Junior";
  if (lower.includes("senior")) return "Senior";

  const gradMatch = text.match(/\b(20\d{2})\b/);
  if (gradMatch) return gradMatch[1];

  return null;
}

function extractLikelyName(text: string): string | null {
  const firstLines = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of firstLines) {
    if (
      line.length >= 5 &&
      line.length <= 50 &&
      !line.includes("@") &&
      !/\d{3}/.test(line) &&
      /^[A-Za-z ,.'-]+$/.test(line)
    ) {
      return line;
    }
  }

  return null;
}

function extractSkills(text: string): string[] {
  const knownSkills = [
    "Lean",
    "Excel",
    "Quality",
    "Process Improvement",
    "SQL",
    "Python",
    "R",
    "Minitab",
    "Tableau",
    "Power BI",
    "Six Sigma",
    "Root Cause Analysis",
    "SPC",
    "Data Analysis",
    "Project Management",
    "AutoCAD",
    "SolidWorks",
    "Supply Chain",
  ];

  const lower = text.toLowerCase();
  return knownSkills.filter((skill) => lower.includes(skill.toLowerCase()));
}

function inferRoleTypes(text: string): string[] {
  const lower = text.toLowerCase();
  const result: string[] = [];

  if (lower.includes("intern")) result.push("Internship");
  if (lower.includes("co-op") || lower.includes("coop")) result.push("Co-op");
  if (lower.includes("full-time") || lower.includes("full time")) result.push("Full-time");

  return result;
}

function inferWorkModes(text: string): string[] {
  const lower = text.toLowerCase();
  const result: string[] = [];

  if (lower.includes("remote")) result.push("Remote");
  if (lower.includes("hybrid")) result.push("Hybrid");
  if (lower.includes("on-site") || lower.includes("onsite")) result.push("On-site");

  return result;
}

function buildBio(text: string, major: string | null): string | null {
  const summaryMatch = text.match(/(summary|objective|profile)\s*[:\n]+([\s\S]{0,500})/i);

  if (summaryMatch?.[2]) {
    const cleaned = normalizeWhitespace(summaryMatch[2])
      .split("\n")
      .slice(0, 2)
      .join(" ");
    return cleaned.slice(0, 280);
  }

  if (major) {
    return `${major} student interested in engineering, operations, and professional growth.`;
  }

  return null;
}

async function extractPdfText(arrayBuffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");

    fullText += `\n${pageText}`;
  }

  return normalizeWhitespace(fullText);
}

async function extractResumeText(fileName: string, arrayBuffer: ArrayBuffer) {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return normalizeWhitespace(result.value || "");
  }

  if (lower.endsWith(".pdf")) {
    return await extractPdfText(arrayBuffer);
  }

  throw new Error("Unsupported file type. Please upload a PDF or DOCX.");
}

async function aiParseResume(rawText: string) {
  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "Extract student profile information from a resume. Return only the requested fields. " +
              "Use null for unknown scalar values and [] for unknown arrays. " +
              "Do not invent facts. Infer only when strongly supported by the text.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Resume text:\n\n${rawText}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "resume_profile_extract",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            display_name: { type: ["string", "null"] },
            major: { type: ["string", "null"] },
            class_year: { type: ["string", "null"] },
            gpa: { type: ["number", "null"] },
            preferred_work_modes: {
              type: "array",
              items: { type: "string" },
            },
            interested_role_types: {
              type: "array",
              items: { type: "string" },
            },
            skills: {
              type: "array",
              items: { type: "string" },
            },
            bio: { type: ["string", "null"] },
          },
          required: [
            "display_name",
            "major",
            "class_year",
            "gpa",
            "preferred_work_modes",
            "interested_role_types",
            "skills",
            "bio",
          ],
        },
      },
    },
  });

  const text = response.output_text;
  return JSON.parse(text);
}

function mergeParsed(ruleParsed: any, aiParsed: any) {
  return {
    display_name: aiParsed.display_name || ruleParsed.display_name || null,
    major: aiParsed.major || ruleParsed.major || null,
    class_year: aiParsed.class_year || ruleParsed.class_year || null,
    gpa: aiParsed.gpa ?? ruleParsed.gpa ?? null,
    preferred_work_modes:
      aiParsed.preferred_work_modes?.length
        ? aiParsed.preferred_work_modes
        : ruleParsed.preferred_work_modes ?? [],
    interested_role_types:
      aiParsed.interested_role_types?.length
        ? aiParsed.interested_role_types
        : ruleParsed.interested_role_types ?? [],
    skills:
      aiParsed.skills?.length
        ? Array.from(new Set(aiParsed.skills))
        : ruleParsed.skills ?? [],
    bio: aiParsed.bio || ruleParsed.bio || null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const resumeId = body.resumeId as string | undefined;

    if (!resumeId) {
      return NextResponse.json({ error: "Missing resumeId" }, { status: 400 });
    }

    const { data: resume, error: resumeError } = await supabaseAdmin
      .from("student_resumes")
      .select("*")
      .eq("id", resumeId)
      .single();

    if (resumeError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const { data: downloadData, error: downloadError } = await supabaseAdmin.storage
      .from("resumes")
      .download(resume.file_path);

    if (downloadError || !downloadData) {
      return NextResponse.json(
        { error: downloadError?.message ?? "Failed to download resume file" },
        { status: 500 }
      );
    }

    const arrayBuffer = await downloadData.arrayBuffer();
    const rawText = await extractResumeText(resume.file_name, arrayBuffer);

    const ruleParsed = {
      display_name: extractLikelyName(rawText),
      major: extractLikelyMajor(rawText),
      class_year: extractLikelyClassYear(rawText),
      gpa: extractLikelyGpa(rawText),
      preferred_work_modes: inferWorkModes(rawText),
      interested_role_types: inferRoleTypes(rawText),
      skills: extractSkills(rawText),
      bio: buildBio(rawText, extractLikelyMajor(rawText)),
    };

    const aiParsed = await aiParseResume(rawText);
    const parsed = mergeParsed(ruleParsed, aiParsed);

    const { error: updateError } = await supabaseAdmin
      .from("student_resumes")
      .update({
        raw_text: rawText,
        parsed_json: {
          rule_parsed: ruleParsed,
          ai_parsed: aiParsed,
          merged: parsed,
        },
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
