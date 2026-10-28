<script lang="ts">
interface Member {
	nick: string;
	avatar: string;
	link?: string;
	count: number;
}

interface Props {
	commenters: Member[];
}

let { commenters }: Props = $props();
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<span class="sidebar-title">评论成员</span>
		<span class="members-icon">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
			<span class="members-count">{commenters.length}</span>
		</span>
	</div>
	<div class="sidebar-list">
		{#each commenters as member (member.nick)}
			<div class="sidebar-member">
				<div class="member-avatar">
					{#if member.avatar}
						<img src={member.avatar} alt={member.nick} loading="lazy" />
					{:else}
						<span class="avatar-fallback">{member.nick.charAt(0)}</span>
					{/if}
				</div>
				<div class="member-info">
					{#if member.link}
						<a class="member-nick member-nick--link" href={member.link} target="_blank" rel="noopener">{member.nick}</a>
					{:else}
						<span class="member-nick">{member.nick}</span>
					{/if}
					<span class="member-count">{member.count} 条评论</span>
				</div>
			</div>
		{/each}
	</div>
</aside>

<style>
	.sidebar {
		flex: 0 0 11rem;
		height: 100%;
		border-left: 1px solid var(--line-divider);
		background: var(--guestbook-editor-bg);
		overflow-y: auto;
		padding: var(--space-3);
	}

	.sidebar-header {
		display: flex; align-items: center; gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.sidebar-title {
		font-size: 0.76rem; font-weight: 700;
		color: var(--guestbook-muted);
		text-transform: uppercase; letter-spacing: 0.05em;
		padding-left: var(--space-2);
		border-left: 3px solid var(--primary);
	}

	.members-icon {
		display: inline-flex; align-items: center; gap: 4px;
		color: var(--guestbook-muted);
	}
	.members-count {
		font-size: 0.75rem; font-weight: 600;
	}

	.sidebar-list { display: flex; flex-direction: column; gap: var(--space-2); }

	.sidebar-member {
		display: flex; align-items: center; gap: var(--space-2);
		padding: var(--space-1) 0;
	}

	.member-avatar {
		flex: 0 0 auto;
		width: 1.75rem; height: 1.75rem;
		border-radius: var(--radius-full);
		overflow: hidden;
		border: 1px solid var(--guestbook-line);
		background: var(--guestbook-panel);
		display: grid; place-items: center;
	}
	.member-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.member-avatar .avatar-fallback {
		font-size: 0.6rem; font-weight: 700;
		color: var(--guestbook-muted);
	}

	.member-info { flex: 1; min-width: 0; }
	.member-nick {
		display: block; font-size: 0.8125rem; font-weight: 600;
		color: var(--deep-text);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	.member-nick--link { color: var(--guestbook-link); text-decoration: none; }
	.member-nick--link:hover { text-decoration: underline; }
	.member-count {
		display: block; font-size: 0.6875rem;
		color: var(--guestbook-muted);
	}
</style>
