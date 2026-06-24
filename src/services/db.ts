import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  increment,
  runTransaction
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Cliente, Tecnico, Equipo, Servicio, Historial, Presupuesto, PresupuestoItem, Gasto, EstadoServicio } from "../types";

// Helper to convert Firestore Timestamps to JS Dates
export const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string") return new Date(timestamp);
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return null;
};

// ============================================================================
// CLIENTES SERVICES
// ============================================================================
export const ClientesService = {
  async getAll(): Promise<Cliente[]> {
    const colRef = collection(db, "clientes");
    const q = query(colRef, orderBy("nombreApellido", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Cliente[];
  },

  async create(cliente: Omit<Cliente, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const colRef = collection(db, "clientes");
    const docRef = await addDoc(colRef, {
      ...cliente,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, cliente: Partial<Cliente>): Promise<void> {
    const docRef = doc(db, "clientes", id);
    await updateDoc(docRef, {
      ...cliente,
      updatedAt: serverTimestamp()
    });
  },

  async getById(id: string): Promise<Cliente | null> {
    if (!id) return null;
    const docRef = doc(db, "clientes", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Cliente;
  }
};

// ============================================================================
// TECNICOS SERVICES
// ============================================================================
export const TecnicosService = {
  async getAll(): Promise<Tecnico[]> {
    const colRef = collection(db, "tecnicos");
    const q = query(colRef, orderBy("nombre", "asc"));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tecnico[];

    try {
      // Also fetch users from the "users" collection with role "tecnico"
      const usersColRef = collection(db, "users");
      const usersQ = query(usersColRef, where("rol", "==", "tecnico"));
      const usersSnapshot = await getDocs(usersQ);
      const usersList = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          nombre: data.nombre || data.nombreApellido || "Técnico de Sistema",
          telefono: data.telefono || data.telCel || "",
          especialidad: data.especialidad || "",
          activo: data.activo !== false,
          createdAt: data.createdAt || null
        } as Tecnico;
      });

      // Merge both lists, deduplicating by ID/uid
      const mergedMap = new Map<string, Tecnico>();
      list.forEach(t => {
        if (t.id) mergedMap.set(t.id, t);
      });
      usersList.forEach(t => {
        if (t.id && !mergedMap.has(t.id)) {
          mergedMap.set(t.id, t);
        }
      });

      const mergedList = Array.from(mergedMap.values());
      // Sort by name case-insensitive
      mergedList.sort((a, b) => a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase()));
      return mergedList;
    } catch (e) {
      console.error("Error fetching system technicians:", e);
      return list;
    }
  },

  async create(tecnico: Omit<Tecnico, "id" | "createdAt">): Promise<string> {
    const colRef = collection(db, "tecnicos");
    const docRef = await addDoc(colRef, {
      ...tecnico,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, tecnico: Partial<Tecnico>): Promise<void> {
    const docRef = doc(db, "tecnicos", id);
    await updateDoc(docRef, tecnico);
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, "tecnicos", id);
    await deleteDoc(docRef);
  }
};

// ============================================================================
// EQUIPOS SERVICES
// ============================================================================
export const EquiposService = {
  async getAll(): Promise<Equipo[]> {
    const colRef = collection(db, "equipos");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Equipo[];
  },

  async getByCliente(clienteId: string): Promise<Equipo[]> {
    const colRef = collection(db, "equipos");
    const q = query(colRef, where("clienteId", "==", clienteId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Equipo[];
  },

  async create(equipo: Omit<Equipo, "id" | "createdAt">): Promise<string> {
    const colRef = collection(db, "equipos");
    const docRef = await addDoc(colRef, {
      ...equipo,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, equipo: Partial<Equipo>): Promise<void> {
    const docRef = doc(db, "equipos", id);
    await updateDoc(docRef, equipo);
  },

  async getById(id: string): Promise<Equipo | null> {
    if (!id) return null;
    const docRef = doc(db, "equipos", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Equipo;
  }
};

// ============================================================================
// SERVICIOS SERVICES
// ============================================================================
export const ServiciosService = {
  async getAll(): Promise<Servicio[]> {
    const colRef = collection(db, "servicios");
    const q = query(colRef, orderBy("numeroServicio", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Servicio[];
  },

  async getById(id: string): Promise<Servicio | null> {
    if (!id) return null;
    const docRef = doc(db, "servicios", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Servicio;
  },

  async create(
    servicio: Omit<Servicio, "id" | "numeroServicio" | "createdAt" | "updatedAt" | "estado">,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<string> {
    const colRef = collection(db, "servicios");
    
    // Auto-incremental numeroServicio using a simple transaction or scan
    // Scan for highest is very robust for Spark plan
    const qHighest = query(colRef, orderBy("numeroServicio", "desc"), limit(1));
    const highestSnap = await getDocs(qHighest);
    
    let nextNum = 1001;
    if (!highestSnap.empty) {
      const highestDoc = highestSnap.docs[0].data() as Servicio;
      if (highestDoc.numeroServicio) {
        nextNum = highestDoc.numeroServicio + 1;
      }
    }

    const docRef = await addDoc(colRef, {
      ...servicio,
      numeroServicio: nextNum,
      estado: "RECIBIDO" as EstadoServicio,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Registrar en Historial
    await this.registrarHistorial(docRef.id, usuarioId, usuarioNombre, "CREACION", "Servicio técnico ingresado al taller");

    return docRef.id;
  },

  async update(
    id: string, 
    fields: Partial<Servicio>, 
    usuarioId: string, 
    usuarioNombre: string,
    cambioDetalle?: string
  ): Promise<void> {
    const docRef = doc(db, "servicios", id);
    const originalSnap = await getDoc(docRef);
    const original = originalSnap.data() as Servicio;

    await updateDoc(docRef, {
      ...fields,
      updatedAt: serverTimestamp()
    });

    // Detect modifications to trigger log history
    if (fields.estado && fields.estado !== original.estado) {
      await this.registrarHistorial(id, usuarioId, usuarioNombre, "CAMBIO_ESTADO", `Estado modificado de ${original.estado} a ${fields.estado}`);
    }

    if (fields.tecnicoId && fields.tecnicoId !== original.tecnicoId) {
      let tecName = "Técnico";
      const tecSnap = await getDoc(doc(db, "tecnicos", fields.tecnicoId));
      if (tecSnap.exists()) {
        tecName = (tecSnap.data() as Tecnico).nombre;
      } else {
        const userSnap = await getDoc(doc(db, "users", fields.tecnicoId));
        if (userSnap.exists()) {
          tecName = (userSnap.data() as any).nombre;
        }
      }
      await this.registrarHistorial(id, usuarioId, usuarioNombre, "ASIGNACION_TECNICO", `Técnico asignado: ${tecName}`);
    }

    if (fields.presupuesto !== undefined && fields.presupuesto !== original.presupuesto) {
      await this.registrarHistorial(id, usuarioId, usuarioNombre, "EDICION_PRESUPUESTO", `Monto de presupuesto actualizado a $${fields.presupuesto}`);
    }

    if (fields.entregado !== undefined && fields.entregado !== original.entregado) {
      if (fields.entregado) {
        await this.registrarHistorial(id, usuarioId, usuarioNombre, "ENTREGA", "Equipo entregado al cliente final");
      } else {
        await this.registrarHistorial(id, usuarioId, usuarioNombre, "MODIFICACION", "Marcado de entrega removido");
      }
    }

    if (cambioDetalle) {
      await this.registrarHistorial(id, usuarioId, usuarioNombre, "MODIFICACION", cambioDetalle);
    }
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, "servicios", id);
    await deleteDoc(docRef);
  },

  // Historial Subcollection operations
  async getHistorial(servicioId: string): Promise<Historial[]> {
    const colRef = collection(db, "servicios", servicioId, "historial");
    const q = query(colRef, orderBy("fecha", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Historial[];
  },

  async registrarHistorial(
    servicioId: string,
    usuarioId: string,
    usuarioNombre: string,
    accion: string,
    detalle?: string
  ): Promise<void> {
    const colRef = collection(db, "servicios", servicioId, "historial");
    await addDoc(colRef, {
      fecha: serverTimestamp(),
      usuarioId,
      usuarioNombre,
      accion,
      detalle
    });
  }
};

// ============================================================================
// PRESUPUESTOS SERVICES
// ============================================================================
export const PresupuestosService = {
  async getByServicio(servicioId: string): Promise<Presupuesto[]> {
    const colRef = collection(db, "presupuestos");
    const q = query(colRef, where("servicioId", "==", servicioId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Presupuesto[];
  },

  async getById(id: string): Promise<Presupuesto | null> {
    const docRef = doc(db, "presupuestos", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Presupuesto;
  },

  async create(
    presupuesto: Omit<Presupuesto, "id" | "fechaCreacion">, 
    items: Omit<PresupuestoItem, "id">[]
  ): Promise<string> {
    const colRef = collection(db, "presupuestos");
    
    // Add budget
    const docRef = await addDoc(colRef, {
      ...presupuesto,
      fechaCreacion: serverTimestamp()
    });

    // Add items to subcollection
    const itemsColRef = collection(db, "presupuestos", docRef.id, "items");
    for (const item of items) {
      await addDoc(itemsColRef, item);
    }

    return docRef.id;
  },

  async update(
    id: string, 
    presupuesto: Partial<Presupuesto>, 
    items?: Omit<PresupuestoItem, "id">[]
  ): Promise<void> {
    const docRef = doc(db, "presupuestos", id);
    await updateDoc(docRef, presupuesto);

    if (items) {
      // Re-write items
      const itemsColRef = collection(db, "presupuestos", id, "items");
      // Delete existing
      const existingSnap = await getDocs(itemsColRef);
      for (const itemDoc of existingSnap.docs) {
        await deleteDoc(doc(db, "presupuestos", id, "items", itemDoc.id));
      }
      // Add new
      for (const item of items) {
        await addDoc(itemsColRef, item);
      }
    }
  },

  async getItems(presupuestoId: string): Promise<PresupuestoItem[]> {
    const colRef = collection(db, "presupuestos", presupuestoId, "items");
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PresupuestoItem[];
  }
};

// ============================================================================
// GASTOS SERVICES
// ============================================================================
export const GastosService = {
  async getAll(): Promise<Gasto[]> {
    const colRef = collection(db, "gastos");
    const q = query(colRef, orderBy("fecha", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Gasto[];
  },

  async create(gasto: Omit<Gasto, "id" | "fecha">): Promise<string> {
    const colRef = collection(db, "gastos");
    const docRef = await addDoc(colRef, {
      ...gasto,
      fecha: serverTimestamp()
    });
    return docRef.id;
  },

  async update(id: string, gasto: Partial<Gasto>): Promise<void> {
    const docRef = doc(db, "gastos", id);
    await updateDoc(docRef, gasto);
  },

  async delete(id: string): Promise<void> {
    const docRef = doc(db, "gastos", id);
    await deleteDoc(docRef);
  }
};
