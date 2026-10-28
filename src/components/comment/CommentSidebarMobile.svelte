<script lang="ts">
interface Member {
	nick: string;
	avatar: string;
	link?: string;
	count: number;
}

interface Props {
	commenters: Member[];
	isOpen: boolean;
	onClose: () => void;
}

let { commenters, isOpen, onClose }: Props = $props();
</script>

{#if isOpen}
	<!-- backdrop 点击关闭遮罩；键盘操作走关闭按钮（aria-label="关闭"），此处补 role/keydown 满足 a11y -->
	<div class="backdrop" role="button" tabindex="-1" onclick={onClose} onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}></div>
{/if}

<aside class="sidebar" class:is-open={isOpen}>
	<div class="sidebar-header">
		<div class="sidebar-title-wrap">
			<span class="sidebar-title">评论成员</span>
			<span class="sidebar-count">{commenters.length}</span>
		</div>
		<button class="sidebar-close" onclick={onClose} aria-label="关闭">
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
		</button>
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
	.backdrop {
		position: fixed; inset: 0; z-index: 100;
		background: rgba(0, 0, 0, 0.3);
	}

	.sidebar {
		position: fixed; top: 0; right: 0; bottom: 0;
		width: 75vw; max-width: 280px; z-index: 101;
		background: var(--guestbook-editor-bg);
		border-left: 1px solid var(--line-divider);
		overflow-y: auto;
		padding: var(--space-3);
		transform: translateX(100%);
		transition: transform 0.25s ease;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
	}

	.sidebar.is-open { transform: translateX(0); }

	.sidebar-header {
		display: flex; align-items: center; justify-content: space-between;
		margin-bottom: var(--space-3);
	}

	.sidebar-title-wrap {
		display: flex; align-items: center; gap: var(--space-2);
	}

	.sidebar-title {
		font-size: 0.76rem; font-weight: 700;
		color: var(--guestbook-muted);
		text-transform: uppercase; letter-spacing: 0.05em;
		padding-left: var(--space-2);
		border-left: 3px solid var(--primary);
	}

	.sidebar-count {
		display: inline-flex; align-items: center; justify-content: center;
		min-width: 1.25rem; height: 1.25rem; padding: 0 4px;
		border-radius: var(--radius-full);
		background: var(--primary); color: #fff;
		font-size: 0.625rem; font-weight: 700;
	}
	:root.dark .sidebar-count { color: #000; }

	.sidebar-close {
		display: flex; align-items: center; justify-content: center;
		width: 28px; height: 28px; border: none; border-radius: var(--radius-small);
		background: transparent; color: var(--guestbook-muted); cursor: pointer;
	}
	.sidebar-close:hover { background: var(--guestbook-editor-hover); }

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
