"use client";

import { useState } from "react";
import PageTitle from "@/components/ui/common/PageTitle";
import DashboardCard from "@/components/ui/common/DashboardCard";
import AddServer from "./_AddServer";
import ListServer from "./_ListServer";
import { Plus, List } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isViewer } from "@/lib/permissions";

/**
 * Server — reached from the card on the user dashboard.
 *
 * The same two-card shape as Laptop / Desktop, and for the same reasons:
 *
 *   ADD SERVER   the whole record
 *   LIST SERVER  everything on record
 *
 * Opens on the list, because looking at what is already there is the commoner errand and
 * landing on two cards and nothing else gives no sign the page has anything on it.
 *
 * SAVING MOVES YOU TO THE LIST — a row saved into a form you are still looking at gives no
 * sign it went anywhere, and the list is newest first so it is at the top.
 */
export default function ServerPage() {
  // "add", "list", or null when both are closed. Opens on the list.
  const [view, setView] = useState("list");

  // The row the form is open on, or null when adding.
  const [editing, setEditing] = useState(null);

  // Whether that row is open to READ or to CHANGE. The list offers both on the same row:
  // its name opens it to read, the pencil to change it.
  const [readOnly, setReadOnly] = useState(false);

  // The sidebar blue, matching the cards and each panel's own title bar.
  const BAR_COLOR = "#3482AE";

  // A VIEWER only ever reads: no ADD SERVER card, no EDIT, no SUBMIT / UPDATE.
  const { user } = useAuth();
  const viewer = isViewer(user);

  const openAdd = () => {
    setEditing(null);
    setReadOnly(false);
    // Stays open on a second click; another card switches to its own view.
    setView("add");
  };

  const openList = () => {
    setEditing(null);
    setReadOnly(false);
    // Stays open on a second click; another card switches to its own view.
    setView("list");
  };

  const backToList = () => {
    setEditing(null);
    setReadOnly(false);
    setView("list");
  };

  /** The server name — open the row to read it; EDIT there opens it to change. */
  const onView = (row) => {
    setEditing(row);
    setReadOnly(true);
    setView("add");
  };

  return (
    <div className="p-3 sm:p-6">
      {/* showBack on: this page is navigated INTO, so there has to be a way back that is
          not the sidebar. */}
      <PageTitle title="SERVER" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* The same icon and size as ADD DEVICE's card. A VIEWER adds nothing, so none for them. */}
        {!viewer && (
          <DashboardCard
            title="Add Server"
            icon={<Plus className="h-7 w-7" />}
            variant="primary"
            onClick={openAdd}
            tall
          />
        )}
        <DashboardCard
          title="List Server"
          icon={<List className="h-7 w-7" />}
          variant="primary"
          onClick={openList}
          tall
        />
      </div>

      <div className="mt-6">
        {view === "add" && (
          <AddServer
            barColor={BAR_COLOR}
            onSaved={backToList}
            editing={editing}
            readOnly={readOnly || viewer}
            onClose={backToList}
            // EDIT on the view screen: the same server, now open to change. None for a VIEWER.
            onStartEdit={viewer ? undefined : () => setReadOnly(false)}
          />
        )}

        {view === "list" && (
          <ListServer barColor={BAR_COLOR} onView={onView} />
        )}
      </div>
    </div>
  );
}
