import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Authentication is handled by the Stratum application session service." },
    { status: 200 }
  );
}

export async function POST() {
  return NextResponse.json(
    { message: "This authentication endpoint is no longer used." },
    { status: 405 }
  );
}
