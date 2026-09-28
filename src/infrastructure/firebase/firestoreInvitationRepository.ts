import { doc, getDoc, updateDoc, type Firestore } from 'firebase/firestore';

export interface InvitationRecord {
  id: string;
  nombre: string;
  usado: boolean;
}

export interface InvitationRepository {
  findBySecret(secret: string): Promise<InvitationRecord | null>;
  markAsUsed(invitationId: string): Promise<void>;
}

export class FirestoreInvitationRepository implements InvitationRepository {
  constructor(private readonly db: Firestore) {}

  async findBySecret(secret: string): Promise<InvitationRecord | null> {
    const ref = doc(this.db, 'codigos', secret);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as { nombre?: string; usado?: boolean };

    return {
      id: snapshot.id,
      nombre: data.nombre ?? '',
      usado: Boolean(data.usado),
    };
  }

  async markAsUsed(invitationId: string): Promise<void> {
    const ref = doc(this.db, 'codigos', invitationId);
    await updateDoc(ref, { usado: true });
  }
}
