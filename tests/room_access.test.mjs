import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchRoomRecord,
  fetchRoomSheet,
  normalizeRoomId,
  normalizeRoomSheetUrl,
  roomApiUrl,
  safeRoomAssetUrl,
  safeRoomSheetUrl,
} from "../src/lib/roomAccess.js";

test("room identifiers and URLs use one canonical credentialless origin", () => {
  assert.equal(normalizeRoomId("MAD-ROOM_01"), "MAD-ROOM_01");
  assert.equal(
    roomApiUrl("MAD-ROOM_01"),
    "https://backend-spainroom.onrender.com/api/rooms/MAD-ROOM_01"
  );
  for (const value of ["", "../ops", "A/B", " A", "A%2fB", "a".repeat(65)]) {
    assert.equal(normalizeRoomId(value), "", value);
  }

  assert.equal(
    safeRoomAssetUrl("/instance/rooms/MAD-ROOM_01/ficha.pdf"),
    "https://backend-spainroom.onrender.com/instance/rooms/MAD-ROOM_01/ficha.pdf"
  );
  assert.equal(
    safeRoomSheetUrl("/instance/rooms/MAD-ROOM_01/ficha.PDF"),
    "https://backend-spainroom.onrender.com/instance/rooms/MAD-ROOM_01/ficha.PDF"
  );
  assert.equal(
    normalizeRoomSheetUrl(
      "https://backend-spainroom.onrender.com/instance/rooms/MAD-ROOM_01/ficha.pdf"
    ),
    "https://backend-spainroom.onrender.com/instance/rooms/MAD-ROOM_01/ficha.pdf"
  );
  for (const value of [
    "https://backend-spainroom.onrender.com/instance/ficha.pdf",
    "//backend-spainroom.onrender.com/instance/ficha.pdf",
    "/instance/../secreto.pdf",
    "/instance/a/%2e%2e/secreto.pdf",
    "/instance/ficha.html",
    "/api/rooms/ficha.pdf",
  ]) {
    assert.equal(safeRoomSheetUrl(value), "", value);
  }
  for (const value of [
    "https://evil.example/instance/ficha.pdf",
    "https://backend-spainroom.onrender.com.evil.example/instance/ficha.pdf",
    "https://backend-spainroom.onrender.com@evil.example/instance/ficha.pdf",
    "https://backend-spainroom.onrender.com/instance/a/../ficha.pdf",
    "https://backend-spainroom.onrender.com/instance/ficha.pdf?download=1",
    "https://backend-spainroom.onrender.com/instance/ficha.pdf#page=1",
  ]) {
    assert.equal(normalizeRoomSheetUrl(value), "", value);
  }
});

test("room JSON fetch omits RTM credentials and binds the projected room", async () => {
  const calls = [];
  const room = await fetchRoomRecord("MAD-01", {
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response(
        JSON.stringify({
          code: "MAD-01",
          ciudad: "Madrid",
          images: {
            sheet: { url: "/instance/MAD-01/ficha.pdf" },
            meta: { precio: 700, ventana: true },
          },
          ignored_server_field: "not projected",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    },
  });
  assert.equal(calls[0][0], "https://backend-spainroom.onrender.com/api/rooms/MAD-01");
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].mode, "cors");
  assert.equal(calls[0][1].redirect, "error");
  assert.equal(calls[0][1].cache, "no-store");
  assert.equal(room.code, "MAD-01");
  assert.equal(
    room.sheetUrl,
    "https://backend-spainroom.onrender.com/instance/MAD-01/ficha.pdf"
  );
  assert.equal("ignored_server_field" in room, false);

  await assert.rejects(
    fetchRoomRecord("MAD-01", {
      fetchImpl: async () =>
        new Response(JSON.stringify({ code: "MAD-02" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    }),
    /no corresponde/i
  );
});

test("room sheet download is credentialless and accepts only a bounded PDF", async () => {
  const calls = [];
  const result = await fetchRoomSheet("https://backend-spainroom.onrender.com/instance/MAD-01/ficha.pdf", {
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response(new TextEncoder().encode("%PDF-1.7\nfixture"), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    },
  });
  assert.equal(
    calls[0][0],
    "https://backend-spainroom.onrender.com/instance/MAD-01/ficha.pdf"
  );
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].mode, "cors");
  assert.equal(calls[0][1].redirect, "error");
  assert.equal(result.mime, "application/pdf");

  await assert.rejects(
    fetchRoomSheet("https://backend-spainroom.onrender.com/instance/MAD-01/ficha.pdf", {
      fetchImpl: async () =>
        new Response("<html>not a pdf</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    }),
    /PDF/i
  );
});
