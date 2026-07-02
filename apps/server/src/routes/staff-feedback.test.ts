import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const listStaffFeedback = mock(async () => [
	{
		id: "fb_1",
		category: "bug" as const,
		body: "Broken slider",
		pageUrl: "/home",
		status: "open" as const,
		lastStaffReplyAt: null,
		patronLastReadAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		submitter: {
			userId: "user_1",
			handle: "patron",
			displayName: "Patron",
		},
	},
]);
const getStaffFeedbackDetail = mock(async () => ({
	id: "fb_1",
	category: "bug" as const,
	body: "Broken slider",
	pageUrl: "/home",
	status: "open" as const,
	lastStaffReplyAt: null,
	patronLastReadAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	submitter: {
		userId: "user_1",
		handle: "patron",
		displayName: "Patron",
	},
	replies: [],
	staffNotes: [],
}));
const addStaffFeedbackReply = mock(async () => ({ replyId: "fbr_1" }));
const addStaffFeedbackNote = mock(async () => ({ noteId: "fbn_1" }));
const updatePatronFeedbackStatus = mock(async () => ({ ok: true as const }));

mock.module("../lib/patron-feedback", () => ({
	listStaffFeedback,
	getStaffFeedbackDetail,
	addStaffFeedbackReply,
	addStaffFeedbackNote,
	updatePatronFeedbackStatus,
}));

const MATRIX: Record<string, Record<string, string[]>> = {
	owner: {
		feedback: ["read", "reply"],
	},
	admin: {
		feedback: ["read", "reply"],
	},
	support: {
		feedback: ["read"],
	},
	moderator: {},
};

function roleHasPermission(
	role: string,
	permissions: Record<string, string[]>,
): boolean {
	const grants = MATRIX[role];
	if (!grants) return false;
	for (const [resource, actions] of Object.entries(permissions)) {
		const allowed = grants[resource] ?? [];
		for (const action of actions) {
			if (!allowed.includes(action)) return false;
		}
	}
	return true;
}

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				if (!id) return null;
				const role = headers.get("x-user-role") ?? "user";
				return {
					session: { id: `session-${id}` },
					user: { id, role },
				};
			},
			userHasPermission: async ({
				body,
			}: {
				body: { role: string; permissions: Record<string, string[]> };
			}) => ({ success: roleHasPermission(body.role, body.permissions) }),
		},
		handler: () => new Response("ok"),
	},
}));

const { staffFeedbackRoute } = await import("./staff-feedback");

function call(
	path: string,
	init?: {
		method?: string;
		userId?: string;
		userRole?: string;
		body?: unknown;
	},
) {
	const headers: Record<string, string> = {};
	if (init?.userId) headers["x-user-id"] = init.userId;
	if (init?.userRole) headers["x-user-role"] = init.userRole;
	if (init?.body != null) headers["Content-Type"] = "application/json";
	return new Elysia().use(staffFeedbackRoute).handle(
		new Request(`http://localhost${path}`, {
			method: init?.method ?? "GET",
			headers,
			body: init?.body != null ? JSON.stringify(init.body) : undefined,
		}),
	);
}

describe("staffFeedbackRoute", () => {
	beforeEach(() => {
		listStaffFeedback.mockClear();
		getStaffFeedbackDetail.mockClear();
		addStaffFeedbackReply.mockClear();
		addStaffFeedbackNote.mockClear();
		updatePatronFeedbackStatus.mockClear();
	});

	test("GET /api/staff/feedback requires feedback:read", async () => {
		const res = await call("/api/staff/feedback", {
			userId: "mod_1",
			userRole: "moderator",
		});
		expect(res.status).toBe(403);
	});

	test("GET /api/staff/feedback lists for support", async () => {
		const res = await call("/api/staff/feedback", {
			userId: "sup_1",
			userRole: "support",
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.items).toHaveLength(1);
	});

	test("POST /api/staff/feedback/:id/reply requires feedback:reply", async () => {
		const res = await call("/api/staff/feedback/fb_1/reply", {
			method: "POST",
			userId: "sup_1",
			userRole: "support",
			body: { body: "Thanks for reporting this." },
		});
		expect(res.status).toBe(403);
		expect(addStaffFeedbackReply).not.toHaveBeenCalled();
	});

	test("POST /api/staff/feedback/:id/reply succeeds for admin", async () => {
		const res = await call("/api/staff/feedback/fb_1/reply", {
			method: "POST",
			userId: "admin_1",
			userRole: "admin",
			body: { body: "Thanks for reporting this." },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ replyId: "fbr_1" });
		expect(addStaffFeedbackReply).toHaveBeenCalledWith({
			feedbackId: "fb_1",
			authorId: "admin_1",
			body: "Thanks for reporting this.",
		});
	});

	test("POST /api/staff/feedback/:id/notes succeeds for owner", async () => {
		const res = await call("/api/staff/feedback/fb_1/notes", {
			method: "POST",
			userId: "owner_1",
			userRole: "owner",
			body: { body: "Reproduced locally." },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ noteId: "fbn_1" });
	});

	test("PATCH /api/staff/feedback/:id/status resolves ticket", async () => {
		const res = await call("/api/staff/feedback/fb_1/status", {
			method: "PATCH",
			userId: "admin_1",
			userRole: "admin",
			body: { status: "resolved" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(updatePatronFeedbackStatus).toHaveBeenCalledWith({
			feedbackId: "fb_1",
			status: "resolved",
			actorId: "admin_1",
		});
	});
});
