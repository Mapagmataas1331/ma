# Testing

Manual checks for everything the sites do. Use two or three browsers (or a browser and a phone) signed into different accounts. For chat, one account should be able to go offline: close the tab, or block the socket.

Mark each line when it behaves as written. English and Russian both count: switch the language control in the header and repeat any check whose wording you can see.

## Every site

- [ ] Header brand link returns to that site's home.
- [ ] Desktop nav links work. External links open in a new tab.
- [ ] Below the `lg` width, the menu button opens the same links and closes after a choice.
- [ ] Light and dark theme toggle, and the choice survives a reload.
- [ ] Language switch EN/RU updates the visible copy and survives a reload.
- [ ] Ctrl+K or Cmd+K opens the command list. Choosing an item navigates. Escape closes it.
- [ ] Settings opens from the header. On chat, chat settings appear under the account section. Closing settings returns to the page.
- [ ] Pages do not scroll sideways on a narrow phone. The header clears the safe area.

## ma.cyou

- [ ] Lead, intro, and the three cards (résumé, projects, chat) render in both languages, each with its blurb.
- [ ] Each card opens the right site.
- [ ] Social badges open email, GitHub, Telegram, and YouTube.
- [ ] `/dev/gallery` renders the component gallery without throwing.

## me.ma.cyou

- [ ] Name, photo, lead, chips, stats, and facts match the selected language.
- [ ] Clicking the photo opens a lightbox. Closing it returns to the page.
- [ ] About, highlights, experience, education, and projects sections render, including the last item in each list.
- [ ] A project link on the résumé opens the matching projects page.

## projects.ma.cyou

- [ ] The list shows every project, with tags, year, and a summary in the selected language.
- [ ] "All" and each tag filter the list. A tag with one project shows only that project. Clearing the tag shows all of them again.
- [ ] Opening a project shows its title, summary, tags, external links, and markdown body in the selected language.
- [ ] An unknown `/p/...` slug shows the not-found line and a way back to the list.
- [ ] The back link on a project returns to the list.

## Account (settings on any site)

- [ ] Signed out: the form rejects a bad username, a short password, and a bad display name, and explains why.
- [ ] Register with an invite creates the account and returns to sign-in. A used or unknown invite fails.
- [ ] Sign-in with the wrong password fails. Sign-in with the right password shows the account.
- [ ] An account with two-factor on is told to finish sign-in in chat.
- [ ] Signed in: display name, @username, badges, and invite credits match the account.
- [ ] Creating an invite shows a one-time code and spends a credit. Revoking an open invite removes it. With zero credits the button stays disabled.
- [ ] People invited are listed. An empty list says so.
- [ ] Sign out returns to the signed-out form.
- [ ] The @ma feedback control opens a chat with that user when already on chat, and otherwise sends you to chat.

## Chat sign-in and vault

- [ ] Login, register, and the two-factor step work from the chat app itself, including a wrong code and an expired challenge.
- [ ] First unlock creates a vault. The password must be entered twice and must differ from the account password. The explainer says what the vault is.
- [ ] The wrong vault password is rejected. The right one opens the chats.
- [ ] Lock from settings returns to the unlock screen. Unlocking again shows the same chats.
- [ ] Changing the vault password with the current one works. The old password then fails.
- [ ] A recovery key can be created, copied, and is not shown again after the dialog closes.
- [ ] Before the vault is unlocked, "Clear all local data" is still available. Confirming it removes chats, files, the legacy `ma-chat` database, and cached pages. Cancel leaves data in place.
- [ ] A legacy vault whose identity matches the account can be imported. A mismatch is refused.
- [ ] A vault created for a different account on this browser is not opened for the new account.

## Contacts and direct chats

- [ ] Adding a username that exists opens a direct chat. An unknown username is reported.
- [ ] An incoming contact can be accepted. Until then, messages do not go through.
- [ ] Blocking a contact stops delivery both ways. Unblocking restores it.
- [ ] The conversation list sorts pinned chats first, then by the latest message.
- [ ] Pin, unpin, mute, and unmute persist after a reload.
- [ ] Clear history removes that chat's messages and files from this device only, after confirm. Cancel keeps them.
- [ ] Online and offline are shown on a direct chat.

## Messages

- [ ] A text message to someone online appears on their device without a reload.
- [ ] The same message to someone offline is waiting when they next open chat.
- [ ] Enter-to-send on and off both match the setting. Shift+Enter inserts a line when enter-to-send is on.
- [ ] Empty sends do nothing.
- [ ] Your own messages show sending, then sent, delivered, and read as the other person receives and opens the chat.
- [ ] In a group, each member gets the message, and sender names show when that setting is on. Turning names off hides them.
- [ ] Typing shows the other person's name and disappears after they stop.
- [ ] Day dividers appear between days. The thread stays at the bottom on a new message, and stays put if you have scrolled up.
- [ ] Delete for me removes the message on this device only.
- [ ] 12-hour and 24-hour time match the setting and survive a reload.
- [ ] A message you send to yourself (saved messages) stays on this device.

## Groups

- [ ] Creating a group requires a valid name and at least one accepted contact. The creator is the owner.
- [ ] Only the owner and admins see rename and add. A member does not.
- [ ] Adding someone who is not an accepted contact fails. Adding a 21st member fails.
- [ ] Rename updates the title for every member.
- [ ] The owner can transfer ownership. After that, the previous owner can leave.
- [ ] The owner cannot leave while other members remain, and is told to transfer first.
- [ ] The owner can delete the group. Other members can leave. Removed members lose the group.
- [ ] Presence dots in the member list match who is actually online.
- [ ] A member who joins after a message was sent does not retroactively receive that old message.

## Files, while everyone who should receive them is online

- [ ] A small file sent in a direct chat transfers without using the cloud. The sender can cancel. The receiver sees progress and can cancel.
- [ ] An image opens in the viewer. A video plays there. Audio has a player. Another file downloads.
- [ ] Share uses the system share sheet where the browser allows it, and says it is unavailable otherwise.
- [ ] The sender can reload and still hand the file over, as long as it fits this device's storage budget.
- [ ] A file that does not fit the device budget still transfers in the open tab. After a reload it is no longer offered, and the other person sees that it is not available.
- [ ] Availability before a click reads as on this device, available to download, or not available anymore. It does not wait for a failed click to say the file is gone.
- [ ] Two transfers at once are refused with the busy message. After the first finishes, the next one can start.
- [ ] Relay-only mode still completes a transfer when a direct path is unavailable.

## Files, when someone is offline

- [ ] A file of 5 GB or less to an offline person is stored once in the sender's cloud. Sending 1 GB and then 2 GB shows about 3 GB of 5 GB used.
- [ ] Messages are not counted in that 5 GB.
- [ ] A group file is one copy linked to each offline member, not one copy per member.
- [ ] Each offline member can download it from the cloud after they come online, then the waiting count drops. When the last of them has it, or the sender removes it, or 24 hours pass, the copy is gone.
- [ ] A file larger than 5 GB, with someone offline and someone online, tells the sender it can only go to people who are online, and those people receive it. Offline members do not get a cloud copy.
- [ ] The same oversized file with nobody else online is not sent, and the draft is restored.
- [ ] A file of 5 GB or less that does not fit the remaining cloud space opens the quota dialog. It names what is using the space. Remove frees that file. Send to online users delivers only to people online right now, and says offline members will not get it.
- [ ] If nobody else is online, that dialog has no "send to online users" action.
- [ ] Settings → cloud storage shows the same used space and can remove a waiting file.

## Files, group hand-off

Use three members. Call them A (sends), B (receives first), and C (the one who was offline or who downloads last).

- [ ] A sends a file larger than 5 GB while B and C are online. A closes the tab after B has the file. C downloads it from B.
- [ ] If both A and B still have it, C is served by whichever has the lower ping.
- [ ] If the closest holder is busy, C gets the file from the next holder, or the request is tried again.
- [ ] C comes online while A is still sending a direct file. C sees the message and can download it from A, or from B once B has finished.
- [ ] The same late arrival during a cloud upload: C can take the file from A while the upload is running, and can also download the server copy once the upload has finished.
- [ ] A message that is text plus a direct file: C was offline at the start, comes online while the file is still moving, and receives both the text and the file.
- [ ] C stays offline until the cloud copy is stored, then comes online later. The message and the file are waiting, and the download uses the server.
- [ ] C stays offline for the whole direct send, and only comes online after everyone has stopped transferring and closed the file. C does not receive that direct file.
- [ ] After B has the file, A and B both go offline before C downloads. C sees that nobody with the file is online. When B returns, C can download.
- [ ] Removing the cloud file while C has not downloaded it marks the file unavailable for C.

## Device storage

- [ ] Settings show chats, files, and the outbox queue separately, and the total.
- [ ] Lowering the limit drops the oldest files first and removes their messages. Raising it keeps new files.
- [ ] Setting the limit to unlimited (empty / 0, shown as ∞) stops eviction.
- [ ] Clean storage removes old files and reports what it removed. A second run reports that nothing was left.

## Devices, pairing, and two-factor

- [ ] The device list shows this device and others, with a friendly name and the last trusted device protected from revoke until another is trusted.
- [ ] Revoking another device signs that device out. Trusting a pending device lets it in.
- [ ] Link device shows a code, a QR, and a fingerprint. The new device enters the code, both sides see the same fingerprint, and confirm copies the vault. Cancel throws the code away.
- [ ] A wrong pairing code fails. A second claim of the same code fails.
- [ ] After pairing, both devices show the same chats. A message sent on one appears on the other when both are online.
- [ ] Turning on two-factor shows a secret and recovery codes. The next sign-in asks for a code. A recovery code works once. Reconfigure replaces the old setup.

## Push, errors, and session

- [ ] With notifications allowed, a message arriving while the tab is in the background can notify. Mute on that chat does not.
- [ ] Signing out on one device does not wipe the vault key on another device.
- [ ] An expired session returns to sign-in instead of showing a blank chat.
- [ ] Server overload, rate limit, and "device not trusted" each show their own message, not a stack trace.
