import Appointment from "../models/appointmentModel.js";
import Recording from "../models/recordingModel.js";

/**
 * GET /api/dashboard/stats
 * Retrieves aggregated performance data for dashboard view.
 */
export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.userId;
        const { period, startDate, endDate } = req.query;

        // ---- build date range (or none) ----
        const hasDateParams = Boolean(period || startDate || endDate);
        let dateFilter = null;

        if (hasDateParams) {
            const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

            let from, to;
            if (startDate || endDate) {
                from = startDate ? new Date(startDate) : new Date(0); // all-time start if only endDate
                to = endDate ? new Date(endDate) : new Date();  // today if only startDate
            } else if (period) {
                const now = new Date();
                switch (period) {
                    case "week": {
                        // current calendar week: last 7 days including today
                        const f = new Date(now);
                        f.setDate(now.getDate() - 6);
                        from = f; to = now;
                        break;
                    }
                    case "month": {
                        from = new Date(now.getFullYear(), now.getMonth(), 1);
                        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                        break;
                    }
                    case "quarter": {
                        const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
                        from = new Date(now.getFullYear(), qStartMonth, 1);
                        to = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59, 999);
                        break;
                    }
                    case "year": {
                        from = new Date(now.getFullYear(), 0, 1);
                        to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                        break;
                    }
                    default: {
                        // fallback: current calendar month
                        from = new Date(now.getFullYear(), now.getMonth(), 1);
                        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    }
                }
            }

            if (from && to) {
                from = startOfDay(from);
                to = endOfDay(to);
                dateFilter = { $gte: from, $lte: to };
            }
        }

        // ---- queries (apply date filter only when present) ----
        const recordingQuery = { userId, status: { $ne: "deleted" } };
        if (dateFilter) recordingQuery.createdAt = dateFilter;

        const apptQuery = { userId };
        if (dateFilter) apptQuery.scheduledDate = dateFilter;

        const recordings = await Recording.find(recordingQuery);
        const totalCalls = recordings.length;

        const spinScores = recordings
            .filter(r => r.analysis?.spin?.overall?.score)
            .map(r => r.analysis.spin.overall.score);
        const avgSpinScore = spinScores.length
            ? Math.round(spinScores.reduce((a, b) => a + b, 0) / spinScores.length)
            : 0;

        const totalAppointments = await Appointment.countDocuments(apptQuery);

        // sentiment %
        const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
        recordings.forEach(r => {
            const s = r.analysis?.sentiment?.overall;
            if (!s) return;
            if (s.includes("positive")) sentimentCounts.positive++;
            else if (s.includes("negative")) sentimentCounts.negative++;
            else sentimentCounts.neutral++;
        });
        const sTotal = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative || 1;
        const sentimentDistribution = {
            positive: Math.round((sentimentCounts.positive / sTotal) * 100),
            neutral: Math.round((sentimentCounts.neutral / sTotal) * 100),
            negative: Math.round((sentimentCounts.negative / sTotal) * 100),
        };

        // 4-week spin trend (relative to now, independent of dateFilter)
        const spinTrends = { labels: [], scores: [] };
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - i * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);

            const weekly = recordings.filter(r =>
                r.createdAt >= weekStart &&
                r.createdAt < weekEnd &&
                r.analysis?.spin?.overall?.score
            );
            const avg = weekly.length
                ? Math.round(weekly.reduce((sum, r) => sum + r.analysis.spin.overall.score, 0) / weekly.length)
                : 0;

            spinTrends.labels.push(`Week ${4 - i}`);
            spinTrends.scores.push(avg);
        }

        // top questions (first example from each category per recording)
        const topPerformingQuestions = [];
        recordings.forEach(r => {
            ["situation", "problem", "implication", "needPayoff"].forEach(cat => {
                const catData = r.analysis?.spin?.[cat];
                if (catData?.examples?.length) {
                    topPerformingQuestions.push({
                        question: catData.examples[0],
                        category: cat,
                        usageCount: catData.count || 0,
                        successRate: (catData.score || 0) / 100,
                    });
                }
            });
        });

        const weeklyImprovement =
            spinTrends.scores.length >= 2
                ? spinTrends.scores.at(-1) - spinTrends.scores.at(-2)
                : 0;

        return res.status(200).json({
            success: true,
            data: {
                totalCalls,
                avgSpinScore,
                totalAppointments,
                weeklyImprovement,
                sentimentDistribution,
                spinTrends,
                topPerformingQuestions: topPerformingQuestions.slice(0, 5),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


