type UmamiStatsResponse = {
	visitors: number | null;
	pageviews: number | null;
	error?: string;
};

function json(body: UmamiStatsResponse, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}

function normalizeBaseUrl(rawBaseUrl: string) {
	try {
		return new URL(rawBaseUrl).origin;
	} catch {
		return rawBaseUrl.replace(/\/+$/, "");
	}
}

async function getUmamiToken(
	baseUrl: string,
	username: string,
	password: string,
) {
	const response = await fetch(`${baseUrl}/api/auth/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({ username, password }),
	});
	const data = (await response.json().catch(() => ({}))) as {
		token?: string;
		data?: { token?: string };
		errmsg?: string;
		message?: string;
	};
	if (!response.ok) {
		throw new Error(
			data.errmsg || data.message || `Umami login failed (${response.status})`,
		);
	}
	const token = data.token || data.data?.token;
	if (!token) {
		throw new Error("Umami login did not return a token");
	}
	return token;
}

async function getUmamiStats(
	baseUrl: string,
	token: string,
	websiteId: string,
) {
	const response = await fetch(
		`${baseUrl}/api/websites/${websiteId}/stats?startAt=0&endAt=${Date.now()}`,
		{
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
		},
	);
	const data = (await response.json().catch(() => ({}))) as {
		visitors?: number;
		pageviews?: number;
		uv?: number;
		pv?: number;
		errmsg?: string;
		message?: string;
	};
	if (!response.ok) {
		throw new Error(
			data.errmsg ||
				data.message ||
				`Umami stats request failed (${response.status})`,
		);
	}
	return data;
}

export async function GET() {
	const rawBaseUrl = import.meta.env.PUBLIC_UMAMI_BASE || "";
	const username = import.meta.env.PUBLIC_UMAMI_USERNAME || "";
	const password = import.meta.env.PUBLIC_UMAMI_PASSWORD || "";
	const websiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID || "";

	if (!rawBaseUrl || !username || !password || !websiteId) {
		return json(
			{ visitors: null, pageviews: null, error: "Missing Umami env vars" },
			503,
		);
	}

	try {
		const baseUrl = normalizeBaseUrl(rawBaseUrl);
		const token = await getUmamiToken(baseUrl, username, password);
		const stats = await getUmamiStats(baseUrl, token, websiteId);
		return json({
			visitors: Number(stats.visitors ?? stats.uv ?? 0),
			pageviews: Number(stats.pageviews ?? stats.pv ?? 0),
		});
	} catch (error) {
		return json(
			{
				visitors: null,
				pageviews: null,
				error:
					error instanceof Error
						? error.message
						: "Failed to fetch Umami stats",
			},
			500,
		);
	}
}
