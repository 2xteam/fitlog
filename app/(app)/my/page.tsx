"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { clearSession, loadSession, type SessionUser } from "@/lib/session";
import { useProfile } from "@/lib/useProfile";

/**
 * 마이페이지 — 신체 프로필 입력·수정.
 *
 * 키·성별·출생연도는 인바디 표준범위와 기초대사량 해석에 쓰인다.
 * 이 값이 없으면 측정 기록을 저장할 수 없어, 업로드 화면이 여기로 보낸다.
 */
export default function MyPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const { profile, complete, loading, reload } = useProfile(session?.id);

  const [heightCm, setHeightCm] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const thisYear = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  // 저장된 값으로 폼을 채운다
  useEffect(() => {
    if (!profile) return;
    setHeightCm(profile.heightCm ? String(profile.heightCm) : "");
    setGender(profile.gender ?? "");
    setBirthYear(profile.birthYear ? String(profile.birthYear) : "");
  }, [profile]);

  const save = async () => {
    if (!session) return;

    // 어떤 칸이 비었는지 분명히 알려준다 (플레이스홀더를 값으로 오해하기 쉽다)
    if (!heightCm.trim()) {
      setMsg("키를 입력해 주세요.");
      return;
    }
    if (!gender) {
      setMsg("성별을 선택해 주세요.");
      return;
    }
    if (!birthYear.trim()) {
      setMsg("출생연도를 입력해 주세요.");
      return;
    }

    setBusy(true);
    setMsg(null);
    setDone(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: session.id,
          heightCm: Number(heightCm),
          gender,
          birthYear: Number(birthYear),
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "저장에 실패했어요.");
        return;
      }
      setDone(true);
      await reload();
    } catch {
      setMsg("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  };

  const age = profile?.birthYear ? thisYear - profile.birthYear : null;

  return (
    <div>
      <Sheet
        tone="dark"
        ornament
        eyebrow="MY PROFILE"
        headline={
          <>
            {session?.name ?? ""}님의
            <br />
            신체 프로필
          </>
        }
        lead={
          <>
            인바디 결과지의 표준범위와 기초대사량은 성별·나이 기준이에요.
            <br />이 정보가 있어야 수치를 제대로 읽어줄 수 있어요.
          </>
        }
      />

      <Sheet eyebrow="BODY PROFILE" headline="기본 정보">
        {loading ? (
          <p className="lead">불러오는 중…</p>
        ) : (
          <div style={{ marginTop: 20 }}>
            <div className="field">
              <label className="field-label" htmlFor="heightCm">
                키 (cm)
              </label>
              <input
                id="heightCm"
                className="field-input"
                type="number"
                inputMode="decimal"
                min={80}
                max={250}
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="예) 179"
                style={
                  msg && !heightCm.trim()
                    ? { borderColor: "var(--danger)", borderWidth: 2 }
                    : undefined
                }
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="gender">
                성별
              </label>
              <select
                id="gender"
                className="field-input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">선택해 주세요</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="birthYear">
                출생연도
              </label>
              <input
                id="birthYear"
                className="field-input"
                type="number"
                inputMode="numeric"
                min={1900}
                max={thisYear}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="예) 1986"
                style={
                  msg && !birthYear.trim()
                    ? { borderColor: "var(--danger)", borderWidth: 2 }
                    : undefined
                }
              />
              {age !== null ? (
                <p className="field-hint">현재 만 {age}세로 계산돼요.</p>
              ) : null}
            </div>

            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => void save()}
              disabled={busy}
            >
              {busy ? "저장 중…" : "저장하기"}
            </button>

            {msg ? (
              <p className="lead" style={{ color: "var(--danger)" }}>
                {msg}
              </p>
            ) : null}
            {done ? (
              <p className="lead" style={{ color: "var(--success)" }}>
                저장했어요.
              </p>
            ) : null}

            <div className="note-block">
              <strong>NOTE</strong>
              키·성별·출생연도는 SnapWord · SnapNote와 공유하는 계정에 저장되지만,
              FitLog에서만 사용해요.
              {complete === false
                ? " 이 정보를 채워야 인바디 결과지를 기록할 수 있어요."
                : ""}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet tone="tint" eyebrow="ACCOUNT" headline="계정">
        <div style={{ marginTop: 16 }}>
          <p className="lead" style={{ marginTop: 0 }}>
            {session?.name} · {session?.phone}
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: 14 }}
            onClick={() => {
              clearSession();
              window.location.href = "/";
            }}
          >
            로그아웃
          </button>
        </div>
      </Sheet>
    </div>
  );
}
