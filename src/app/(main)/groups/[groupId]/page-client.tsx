"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Settings2,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  assignRank,
  createRank,
  getGroup,
  getGroupMembers,
  getGroupPosts,
  getGroupRanks,
  isGroupMember,
  joinGroup,
  leaveGroup,
  updateGroup,
} from "@/services/groups";
import type { Group, GroupRank, PostWithAuthor, UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { ComposeBox } from "@/components/posts/compose-box";
import { PostCard } from "@/components/posts/post-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { assetUrl } from "@/lib/asset-url";

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = String(params.groupId || "");
  const { user } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [member, setMember] = useState(false);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [members, setMembers] = useState<(UserProfile & { rankId?: string })[]>(
    []
  );
  const [ranks, setRanks] = useState<GroupRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newRank, setNewRank] = useState("");
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const g = await getGroup(groupId);
      setGroup(g);
      if (g) {
        setName(g.name);
        setDescription(g.description);
      }
      if (user) setMember(await isGroupMember(groupId, user.uid));
      const [p, m, r] = await Promise.all([
        getGroupPosts(groupId, user?.uid),
        getGroupMembers(groupId),
        getGroupRanks(groupId),
      ]);
      setPosts(p as PostWithAuthor[]);
      setMembers(m);
      setRanks(r);
    } finally {
      setLoading(false);
    }
  }, [groupId, user, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <EmptyState
        icon={Users}
        title="Group not found"
        description="This group may have been removed."
      />
    );
  }

  const isOwner = user?.uid === group.ownerId;

  const onJoin = async () => {
    if (!user) return;
    try {
      await joinGroup(groupId, user.uid);
      setMember(true);
      setGroup((g) => (g ? { ...g, memberCount: g.memberCount + 1 } : g));
      toast.success("Joined group");
      setRefresh((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Join failed");
    }
  };

  const onLeave = async () => {
    if (!user) return;
    try {
      await leaveGroup(groupId, user.uid);
      setMember(false);
      setGroup((g) =>
        g ? { ...g, memberCount: Math.max(0, g.memberCount - 1) } : g
      );
      toast.success("Left group");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Leave failed");
    }
  };

  const onSave = async () => {
    if (!user) return;
    try {
      await updateGroup(groupId, user.uid, { name, description });
      toast.success("Group updated");
      setEditOpen(false);
      setRefresh((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onAddRank = async () => {
    if (!user || !newRank.trim()) return;
    try {
      await createRank(groupId, user.uid, {
        name: newRank.trim(),
        color: "#a855f7",
        order: ranks.length + 1,
        permissions: {
          post: true,
          moderate: false,
          invite: false,
          editGroup: false,
          manageRanks: false,
        },
      });
      setNewRank("");
      toast.success("Rank created");
      setRefresh((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create rank");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center gap-3 glass border-b border-border px-4 py-2">
        <button
          onClick={() => router.push("/groups")}
          className="rounded-full p-2 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{group.name}</h1>
          <p className="text-xs text-muted-foreground">
            {group.memberCount} members
            {group.isPrivate ? " · Private" : " · Public"}
          </p>
        </div>
        {isOwner ? (
          <Button variant="outline" size="icon-sm" onClick={() => setEditOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
        ) : null}
        {member && !isOwner ? (
          <Button variant="outline" size="sm" onClick={onLeave}>
            Leave
          </Button>
        ) : !member ? (
          <Button size="sm" onClick={onJoin}>
            Join
          </Button>
        ) : null}
      </header>

      <div className="border-b border-border">
        <div
          className="h-28 w-full bg-muted sm:h-36"
          style={
            group.bannerUrl
              ? {
                  backgroundImage: `url(${assetUrl(group.bannerUrl)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="-mt-8 flex items-end gap-3 px-4 pb-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-muted text-2xl font-bold">
            {group.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(group.avatarUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              group.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold">{group.name}</h2>
              {group.isPrivate ? <Lock className="h-4 w-4" /> : null}
            </div>
            <p className="mt-0.5 max-w-lg text-sm text-muted-foreground">
              {group.description || "No description yet."}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          {isOwner ? <TabsTrigger value="ranks">Ranks</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="feed">
          {member || !group.isPrivate ? (
            <>
              {member ? (
                <div className="border-b border-border p-4">
                  <ComposeBox
                    groupId={groupId}
                    placeholder={`Post in ${group.name}…`}
                    onSuccess={() => setRefresh((k) => k + 1)}
                  />
                </div>
              ) : null}
              {posts.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No posts in this group"
                  description="Be the first to start a conversation."
                />
              ) : (
                posts.map((p) => <PostCard key={p.id} post={p} />)
              )}
            </>
          ) : (
            <EmptyState
              icon={Lock}
              title="Private group"
              description="Join to see posts and participate."
              action={
                <Button onClick={onJoin}>Join group</Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="members">
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const rank = ranks.find((r) => r.id === m.rankId);
              return (
                <li
                  key={m.uid}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <UserAvatar user={m} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.displayName}</p>
                    <p className="text-sm text-muted-foreground">@{m.username}</p>
                  </div>
                  {rank ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ background: rank.color }}
                    >
                      {rank.name}
                    </span>
                  ) : null}
                  {isOwner && m.uid !== group.ownerId ? (
                    <select
                      className="rounded-lg border border-border bg-card px-2 py-1 text-xs"
                      value={m.rankId || ""}
                      onChange={async (e) => {
                        if (!user) return;
                        try {
                          await assignRank(
                            groupId,
                            user.uid,
                            m.uid,
                            e.target.value
                          );
                          toast.success("Rank updated");
                          setRefresh((k) => k + 1);
                        } catch {
                          toast.error("Could not assign rank");
                        }
                      }}
                    >
                      {ranks.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </TabsContent>

        <TabsContent value="rules">
          <div className="whitespace-pre-wrap p-4 text-[15px] leading-relaxed">
            {group.rules || "No rules set yet."}
          </div>
        </TabsContent>

        {isOwner ? (
          <TabsContent value="ranks">
            <div className="space-y-4 p-4">
              <div className="flex gap-2">
                <Input
                  value={newRank}
                  onChange={(e) => setNewRank(e.target.value)}
                  placeholder="New rank name"
                />
                <Button onClick={onAddRank}>Add</Button>
              </div>
              <ul className="space-y-2">
                {ranks.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: r.color }}
                      />
                      {r.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      order {r.order}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button className="w-full" onClick={onSave}>
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
