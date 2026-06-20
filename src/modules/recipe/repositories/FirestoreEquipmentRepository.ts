"use client";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { stripUndefined } from "@/utils/firestore";
import { deduplicateBy } from "@/utils/array";
import type { EquipmentProfile } from "../models/Equipment";
import { EQUIPMENT_PRESETS } from "../models/Equipment";

export class FirestoreEquipmentRepository {
  private cache: EquipmentProfile[] | null = null;

  constructor(private readonly userId: string) {}

  private get equipmentRef() {
    return collection(db, "equipment");
  }

  async loadAll(): Promise<EquipmentProfile[]> {
    if (this.cache) return this.cache;

    const presets = [...EQUIPMENT_PRESETS];

    const q = query(
      this.equipmentRef,
      where("ownerId", "==", this.userId),
    );
    const snapshot = await getDocs(q);
    const customProfiles = snapshot.docs.map(
      (d) => ({ ...d.data(), name: d.data().name } as EquipmentProfile),
    );

    // Custom profiles override presets with the same name (keep-first)
    const allProfiles = [...customProfiles, ...presets];
    this.cache = deduplicateBy(allProfiles, (p) => p.name);
    return this.cache;
  }

  async saveCustomProfile(profile: EquipmentProfile): Promise<void> {
    const docId = `${this.userId}_${profile.name.replace(/\s+/g, "-").toLowerCase()}`;
    const docRef = doc(this.equipmentRef, docId);
    const clean = stripUndefined({
      ...profile,
      ownerId: this.userId,
      isCustom: true,
    });
    await setDoc(docRef, clean);
    this.cache = null;
  }

  async deleteCustomProfile(name: string): Promise<void> {
    const docId = `${this.userId}_${name.replace(/\s+/g, "-").toLowerCase()}`;
    await deleteDoc(doc(this.equipmentRef, docId));
    this.cache = null;
  }

  async findByName(name: string): Promise<EquipmentProfile | undefined> {
    const profiles = await this.loadAll();
    return profiles.find((p) => p.name === name);
  }

  clearCache(): void {
    this.cache = null;
  }
}
