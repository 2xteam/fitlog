import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { name?: string; phone?: string; email?: string; pin?: string; pinConfirm?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const pinConfirm =
      typeof body.pinConfirm === "string" ? body.pinConfirm : pin;

    if (!nameRaw) {
      return NextResponse.json(
        { ok: false, error: "이름을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (nameRaw.length > 100) {
      return NextResponse.json(
        { ok: false, error: "이름은 100자 이하여야 합니다." },
        { status: 400 },
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!phone || pin.length < 4) {
      return NextResponse.json(
        { ok: false, error: "phone, pin(4자 이상)이 필요합니다." },
        { status: 400 },
      );
    }

    if (pin !== pinConfirm) {
      return NextResponse.json(
        { ok: false, error: "PIN과 PIN 확인이 일치하지 않습니다." },
        { status: 400 },
      );
    }

    const name = nameRaw;

    await connectDB();
    const User = getUserModel();
    const hashed = await bcrypt.hash(pin, 10);
    const user = await User.create({
      name,
      phone,
      email,
      pin: hashed,
      tokens: IS_TOKEN_SYSTEM_ENABLED ? 20 : 0,
    });

    return NextResponse.json({
      ok: true,
      user: { id: String(user._id), name: user.name, phone: user.phone },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
