"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2, Copy, ExternalLink, Loader2, Lock, MessageCircle, Share2, ThumbsUp,
} from "lucide-react";
import { FanpageCampaign, FanpageChecklistItem, isPostCompleted } from "@/lib/fanpage/types";

export interface FanpageChecklistProps {
  month: string;
  campaign: FanpageCampaign;
  items: FanpageChecklistItem[];
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  onChanged: () => void;
}

type ActionKey = "liked" | "shared" | "commented";

interface ManualApiResponse {
  success?: boolean;
  item?: FanpageChecklistItem;
}

interface PendingOverride {
  item: FanpageChecklistItem;
  base: FanpageChecklistItem[];
}

function fmtDayMonth(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return isoDate;
}

function shortPostPath(url: string): string {
  return url.replace(/^https:\/\/(www\.|web\.|m\.)?facebook\.com\//, "");
}

export default function FanpageChecklist({
  month,
  campaign,
  items,
  api,
  onChanged,
}: FanpageChecklistProps) {
  const [pending, setPending] = useState<Record<string, PendingOverride>>({});
  const [savingUrls, setSavingUrls] = useState<Record<string, boolean>>({});

  const localItems = items.map((it) => {
    const ov = pending[it.postUrl];
    if (!ov) return it;
    if (savingUrls[it.postUrl] || ov.base === items) return ov.item;
    return it;
  });

  const req = campaign.requiredActions;
  const showAllActions = !req.like && !req.share && !req.comment;
  const visibleActions: { key: ActionKey; label: string }[] = [];
  if (showAllActions || req.like) visibleActions.push({ key: "liked", label: "Thích" });
  if (showAllActions || req.share) visibleActions.push({ key: "shared", label: "Chia sẻ" });
  if (showAllActions || req.comment) visibleActions.push({ key: "commented", label: "Bình luận" });

  const isLocked = !campaign.allowManual || Boolean(campaign.finalizedAt);
  const completedCount = localItems.filter((it) => isPostCompleted(it, req)).length;

  const copyRandomComment = async () => {
    const pool = (campaign.comments || []).map((c) => c.trim()).filter(Boolean);
    if (!pool.length) {
      toast.error("Chưa có câu bình luận mẫu");
      return;
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    try {
      await navigator.clipboard.writeText(chosen);
      toast.success("Đã copy — dán vào ô bình luận");
    } catch {
      toast.error("Không copy được — vui lòng copy thủ công");
    }
  };

  const toggleAction = async (item: FanpageChecklistItem, key: ActionKey) => {
    if (isLocked) return;
    if (item.byExtension && item[key]) return;
    if (savingUrls[item.postUrl]) return;

    const baseItems = items;
    const nextItem: FanpageChecklistItem = { ...item, [key]: !item[key] };

    setPending((prev) => ({ ...prev, [item.postUrl]: { item: nextItem, base: baseItems } }));
    setSavingUrls((prev) => ({ ...prev, [item.postUrl]: true }));

    try {
      const res = (await api("/api/fanpage/manual", {
        method: "POST",
        body: JSON.stringify({
          month,
          postUrl: item.postUrl,
          liked: nextItem.liked,
          shared: nextItem.shared,
          commented: nextItem.commented,
        }),
      })) as ManualApiResponse;
      if (res && typeof res === "object" && res.item) {
        const updated = res.item;
        setPending((prev) => ({ ...prev, [item.postUrl]: { item: updated, base: baseItems } }));
      }
      onChanged();
    } catch (e) {
      setPending((prev) => {
        const copy = { ...prev };
        delete copy[item.postUrl];
        return copy;
      });
      toast.error(e instanceof Error ? e.message : "Không lưu được trạng thái");
    } finally {
      setSavingUrls((prev) => {
        const copy = { ...prev };
        delete copy[item.postUrl];
        return copy;
      });
    }
  };

  const renderActionIcon = (key: ActionKey, active: boolean, extLocked: boolean) => {
    if (extLocked) return <Lock size={15} className="shrink-0" />;
    if (active) return <CheckCircle2 size={16} className="shrink-0" />;
    if (key === "liked") return <ThumbsUp size={16} className="shrink-0" />;
    if (key === "shared") return <Share2 size={16} className="shrink-0" />;
    return <MessageCircle size={16} className="shrink-0" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-800 text-base sm:text-lg">
          Danh sách bài viết tháng {Number(month.slice(5))}/{month.slice(0, 4)}
        </h2>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
          Đã đạt {completedCount}/{localItems.length} bài
        </span>
      </div>

      {!campaign.allowManual && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-sm text-amber-800 font-medium">
          <Lock size={16} className="shrink-0" />
          <span>BGH chưa mở tự khai tháng này</span>
        </div>
      )}

      {campaign.finalizedAt && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-sm text-emerald-800 font-medium">
          <Lock size={16} className="shrink-0" />
          <span>Tháng đã chốt điểm</span>
        </div>
      )}

      {!localItems.length ? (
        <p className="py-8 px-4 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
          Chưa có bài nào cho tháng này. BGH cần thêm danh sách bài trong Cấu hình tháng.
        </p>
      ) : (
        <div className="space-y-3">
          {localItems.map((item) => {
            const done = isPostCompleted(item, req);
            const isSaving = Boolean(savingUrls[item.postUrl]);

            return (
              <div
                key={item.postUrl}
                className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                  done ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold">
                      {fmtDayMonth(item.postDate)}
                    </span>
                    {item.byExtension && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium">
                        Extension
                      </span>
                    )}
                    {done && (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 size={15} /> Đạt
                      </span>
                    )}
                  </div>
                  {isSaving && <Loader2 size={16} className="animate-spin text-blue-600" />}
                </div>

                {item.note ? (
                  <p className="text-sm text-slate-800 leading-relaxed break-words">{item.note}</p>
                ) : (
                  <p className="text-sm text-slate-500 break-all line-clamp-1">
                    {shortPostPath(item.postUrl)}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <a
                    href={item.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[130px] min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                  >
                    <ExternalLink size={16} /> Mở bài
                  </a>
                  <button
                    type="button"
                    onClick={copyRandomComment}
                    className="flex-1 min-w-[150px] min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium"
                  >
                    <Copy size={16} /> Copy bình luận
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {visibleActions.map(({ key, label }) => {
                    const active = item[key];
                    const extLocked = item.byExtension && active;
                    const disabled = isLocked || extLocked || isSaving;

                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        disabled={disabled}
                        title={extLocked ? "Đã ghi nhận tự động qua Extension" : undefined}
                        onClick={() => toggleAction(item, key)}
                        className={`flex-1 min-w-[104px] min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          active
                            ? extLocked
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800 opacity-90 cursor-not-allowed"
                              : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                        } ${disabled && !extLocked ? "opacity-55 cursor-not-allowed" : ""}`}
                      >
                        {renderActionIcon(key, active, extLocked)}
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
