"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { BrewSession, SessionId } from "../models/BrewSession";

export class FirestoreBrewSessionRepository {
  constructor(private readonly userId: string) {}

  private get sessionsRef() {
    return collection(db, "brewSessions");
  }

  loadAll(): BrewSession[] {
    // Synchronous interface for compatibility — returns empty array.
    // Use loadAllAsync() for actual data.
    return [];
  }

  async loadAllAsync(): Promise<BrewSession[]> {
    const q = query(
      this.sessionsRef,
      where("ownerId", "==", this.userId),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BrewSession);
  }

  loadById(_id: SessionId): BrewSession | null {
    return null;
  }

  async loadByIdAsync(id: SessionId): Promise<BrewSession | null> {
    const docRef = doc(this.sessionsRef, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as BrewSession;
  }

  loadByRecipeId(_recipeId: string): BrewSession[] {
    return [];
  }

  async loadByRecipeIdAsync(recipeId: string): Promise<BrewSession[]> {
    const q = query(
      this.sessionsRef,
      where("ownerId", "==", this.userId),
      where("recipeId", "==", recipeId),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BrewSession);
  }

  save(session: BrewSession): void {
    this.saveAsync(session);
  }

  async saveAsync(session: BrewSession): Promise<void> {
    const docRef = doc(this.sessionsRef, session.id);
    const { id: _id, ...data } = session;
    // JSON round-trip strips undefined values (Firestore rejects them)
    const clean = JSON.parse(JSON.stringify({
      ...data,
      ownerId: this.userId,
      updatedAt: new Date().toISOString(),
    }));
    await setDoc(docRef, clean);
  }

  delete(id: SessionId): void {
    this.deleteAsync(id);
  }

  async deleteAsync(id: SessionId): Promise<void> {
    await deleteDoc(doc(this.sessionsRef, id));
  }

  deleteByRecipeId(recipeId: string): void {
    this.deleteByRecipeIdAsync(recipeId);
  }

  async deleteByRecipeIdAsync(recipeId: string): Promise<void> {
    const sessions = await this.loadByRecipeIdAsync(recipeId);
    await Promise.all(
      sessions.map((s) => deleteDoc(doc(this.sessionsRef, s.id))),
    );
  }

  deleteAll(): void {
    // Not implemented for Firestore
  }

  getSessionCount(_recipeId: string): number {
    // Synchronous — returns 0. Use getSessionCountAsync() for actual count.
    return 0;
  }

  async getSessionCountAsync(recipeId: string): Promise<number> {
    const sessions = await this.loadByRecipeIdAsync(recipeId);
    return sessions.length;
  }
}
