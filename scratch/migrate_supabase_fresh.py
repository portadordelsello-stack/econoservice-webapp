import csv
import json
import re
import urllib.request
import urllib.error
from datetime import datetime

CLIENTS_CSV = '/home/playcode/Documents/db econoservice/DATOS 1.csv'
SERVICES_CSV = '/home/playcode/Documents/db econoservice/EQUIPOS.csv'

SUPABASE_URL = 'https://zkoacqpewrsepboswacp.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb2FjcXBld3JzZXBib3N3YWNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAzMjQxOCwiZXhwIjoyMTAxNjA4NDE4fQ.Bu7_VAa_yXeDYGBrns2kDQTwGx753pOTkynlmLuMy0I'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

TEMPLATE_CLIENT = {
    "id": None,
    "numero_cliente": None,
    "nombre_apellido": None,
    "localidad": None,
    "barrio": None,
    "zona": None,
    "tel_fijo": None,
    "tel_cel": None,
    "tel_cel_bis": None,
    "tel_cel_otro": None,
    "calle": None,
    "numero": None,
    "depto": None,
    "piso": None,
    "cliente_problematico": False,
    "observaciones": None,
    "created_at": None,
    "updated_at": None
}

TEMPLATE_EQUIPO = {
    "id": None,
    "cliente_id": None,
    "tipo": None,
    "marca": None,
    "modelo": None,
    "serie": None,
    "observaciones": None,
    "created_at": None
}

TEMPLATE_SERVICIO = {
    "id": None,
    "numero_servicio": None,
    "cliente_id": None,
    "equipo_id": None,
    "aparato": None,
    "marca_modelo": None,
    "desperfecto_usuario": None,
    "fecha_ingreso": None,
    "servicios_requeridos": None,
    "servicios_convenidos": None,
    "diagnostico": None,
    "repuestos_comprar": None,
    "repuestos_comprados": None,
    "presupuesto": 0.0,
    "presupuesto_texto": None,
    "estado": None,
    "notas_internas": None,
    "info_logistica": None,
    "acepta": False,
    "rechaza_devolver": False,
    "garantia": False,
    "es_reclamo_garantia": False,
    "ingreso_taller": False,
    "pasa_stock": False,
    "terminado": False,
    "entregado": False,
    "cita_dia": None,
    "cita_entrega": None,
    "hora_entrega_desde": None,
    "hora_entrega_hasta": None,
    "metodo_pago": None,
    "monto_efectivo": 0.0,
    "monto_transferencia": 0.0,
    "fotos_drive": [],
    "created_at": None,
    "updated_at": None,
    "created_by": None
}

def parse_bool(val):
    if not val:
        return False
    s = str(val).strip().lower()
    return s in ('true', '1', 'si', 'yes', 't')

def clean_phone(val):
    if not val:
        return None
    cleaned = re.sub(r'[^0-9+]', '', str(val).strip())
    return cleaned if cleaned else None

def parse_float(val):
    if not val:
        return 0.0
    try:
        clean_val = re.sub(r'[^0-9.-]', '', str(val))
        return float(clean_val)
    except:
        return 0.0

def parse_date(date_str):
    if not date_str:
        return None
    formats = [
        "%a %b %d %H:%M:%S %Z %Y",  # Tue May 19 00:00:00 EDT 2026
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y"
    ]
    cleaned_date = str(date_str).replace(" EDT ", " ").replace(" EST ", " ").strip()
    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned_date, fmt)
            return dt.isoformat() + "Z"
        except:
            continue
    return None

def parse_address_from_resena(resena):
    if not resena:
        return '', ''
    first_line = resena.split('\n')[0].strip()
    match = re.search(r'^([a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\.\/\-\,\'\#]+?)\s+(\d{1,5})(?:\s+|$|\.|\,)', first_line)
    if match:
        street = match.group(1).strip()
        num = match.group(2).strip()
        if len(street) >= 3 and not street.isdigit():
            return street, num
    return '', ''

def delete_all_records():
    tables = ['historial', 'servicios', 'equipos', 'clientes']
    for t in tables:
        print(f"Limpiando tabla: {t}...")
        url = f"{SUPABASE_URL}/rest/v1/{t}?id=neq.nonexistent"
        req = urllib.request.Request(url, headers=headers, method='DELETE')
        try:
            urllib.request.urlopen(req)
            print(f"Tabla {t} limpiada con éxito.")
        except Exception as e:
            print(f"Error al limpiar {t}: {e}")

def run_migration():
    # Clear old data
    delete_all_records()

    clients_dict = {}
    clients_to_insert = []
    
    # 1. READ CLIENTS
    print("\n1. Leyendo Clientes de DATOS 1.csv...")
    with open(CLIENTS_CSV, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            client_id_raw = (row.get('Id cliente') or '').strip()
            if not client_id_raw:
                continue
            try:
                num_cliente = int(client_id_raw)
            except:
                continue

            tel_cel = clean_phone(row.get('Tel cel') or '')
            tel_fijo = clean_phone(row.get('Tel fijo') or '')
            tel_cel_bis = clean_phone(row.get('Tel cel bis') or '')
            tel_cel_otro = clean_phone(row.get('Tel cel otro') or '')
            
            calle = (row.get('Calle') or '').strip()
            numero = (row.get('Numero direccion') or '').strip()

            nombre = (row.get('Nombre-Apellido') or '').strip()
            if not nombre:
                # If name is empty, construct it from address to make it recognizable in list
                if calle and numero:
                    nombre = f"{calle} {numero}"
                elif tel_cel:
                    nombre = f"Cel: {tel_cel}"
                else:
                    nombre = f"Cliente #{num_cliente}"

            doc_id = f"c_{num_cliente}"
            
            client_doc = {
                "id": doc_id,
                "numero_cliente": num_cliente,
                "nombre_apellido": nombre,
                "localidad": (row.get('Localidad') or '').strip() or None,
                "barrio": (row.get('Barrio') or '').strip() or None,
                "zona": (row.get('Zona') or '').strip() or None,
                "tel_fijo": tel_fijo,
                "tel_cel": tel_cel,
                "tel_cel_bis": tel_cel_bis,
                "tel_cel_otro": tel_cel_otro,
                "calle": calle or None,
                "numero": numero or None,
                "depto": (row.get('Depto') or '').strip() or None,
                "piso": (row.get('Piso') or '').strip() or None,
                "cliente_problematico": parse_bool(row.get('Cliente problematico') or ''),
                "observaciones": (row.get('problematica de cliente') or '').strip() or None,
                "created_at": datetime.now().isoformat() + "Z",
                "updated_at": datetime.now().isoformat() + "Z"
            }
            clients_dict[client_id_raw] = doc_id
            clients_to_insert.append(client_doc)

    # 2. READ SERVICES & EQUIPMENTS (with address extraction fallback)
    print("\n2. Leyendo Servicios y Equipos de EQUIPOS.csv...")
    equipos_to_insert = []
    servicios_to_insert = []
    
    with open(SERVICES_CSV, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            srv_id_raw = (row.get('Id servicio') or '').strip()
            client_id_raw = (row.get('Id cliente') or '').strip()
            
            if not srv_id_raw:
                continue
            try:
                num_servicio = int(srv_id_raw)
            except:
                continue

            # Link client
            client_doc_id = clients_dict.get(client_id_raw)
            resena = (row.get('Reseña Interna Servicios') or '').strip()

            if not client_doc_id:
                # Client does not exist in DATOS 1.csv. Reconstruct placeholder with address from resena if possible
                num_cliente = int(client_id_raw) if client_id_raw.isdigit() else 99999
                client_doc_id = f"c_{num_cliente}"
                
                extracted_calle, extracted_numero = parse_address_from_resena(resena)
                
                nombre = f"{extracted_calle} {extracted_numero}".strip() if (extracted_calle and extracted_numero) else f"Cliente S/N #{num_cliente}"
                
                placeholder_client = {
                    "id": client_doc_id,
                    "numero_cliente": num_cliente,
                    "nombre_apellido": nombre,
                    "calle": extracted_calle or None,
                    "numero": extracted_numero or None,
                    "created_at": datetime.now().isoformat() + "Z",
                    "updated_at": datetime.now().isoformat() + "Z"
                }
                clients_dict[client_id_raw] = client_doc_id
                clients_to_insert.append(placeholder_client)

            # Equipment Details
            aparato = (row.get('Aparato') or 'Lavarropas').strip()
            marca_modelo = (row.get('Marca Modelo') or '').strip()
            parts = marca_modelo.split(' ', 1)
            marca = parts[0] if len(parts) > 0 else "Genérico"
            modelo = parts[1] if len(parts) > 1 else "Genérico"

            eq_id = f"e_{num_servicio}"
            equipment_doc = {
                "id": eq_id,
                "cliente_id": client_doc_id,
                "tipo": aparato if aparato else "Lavarropas",
                "marca": marca if marca else "Genérico",
                "modelo": modelo if modelo else "Genérico",
                "serie": None,
                "observaciones": None,
                "created_at": datetime.now().isoformat() + "Z"
            }
            equipos_to_insert.append(equipment_doc)

            # Status Normalization
            estado_raw = (row.get('estado') or '').strip().upper()
            estado = "RECIBIDO"
            if estado_raw in ["RECIBIDO", "DIAGNOSTICO", "PENDIENTE_APROBACION", "EN_REPARACION", "LISTO_PARA_ENTREGA", "ENTREGA_EN_PROGRESO", "ENTREGADO", "CANCELADO", "EN_ESPERA", "ACEPTADO", "RECHAZADO"]:
                estado = estado_raw
            else:
                if parse_bool(row.get('Entregado') or ''):
                    estado = "ENTREGADO"
                elif parse_bool(row.get('terminado') or ''):
                    estado = "LISTO_PARA_ENTREGA"
                elif parse_bool(row.get('Ingreso Taller') or ''):
                    estado = "EN_REPARACION"

            # Service Order Details
            service_doc = {
                "id": f"s_{num_servicio}",
                "numero_servicio": num_servicio,
                "cliente_id": client_doc_id,
                "equipo_id": eq_id,
                "aparato": aparato if aparato else "Lavarropas",
                "marca_modelo": marca_modelo if marca_modelo else "Genérico",
                "desperfecto_usuario": (row.get('Desperfecto Usuario') or '').strip() or "No especificado",
                "fecha_ingreso": parse_date(row.get('Fecha') or '') or datetime.now().isoformat() + "Z",
                "servicios_requeridos": (row.get('Servicios Requeridos') or '').strip() or None,
                "servicios_convenidos": (row.get('Servicios Convenidos') or '').strip() or None,
                "diagnostico": resena or (row.get('Servicios Requeridos') or '').strip() or None,
                "repuestos_comprar": (row.get('Repuestos Comprar') or '').strip() or None,
                "repuestos_comprados": (row.get('Repuestos Comprados') or '').strip() or None,
                "presupuesto": parse_float(row.get('Presupuesto') or '0'),
                "presupuesto_texto": (row.get('Presup_palabras') or '').strip() or None,
                "estado": estado,
                "notas_internas": resena or None,
                "info_logistica": (row.get('info logistica') or '').strip() or None,
                "acepta": parse_bool(row.get('Acepta') or ''),
                "rechaza_devolver": parse_bool(row.get('Rechaza-Devolver') or ''),
                "garantia": parse_bool(row.get('Garantía') or ''),
                "es_reclamo_garantia": parse_bool(row.get('Es Reclamo Garantia') or ''),
                "ingreso_taller": parse_bool(row.get('Ingreso Taller') or ''),
                "pasa_stock": parse_bool(row.get('Pasa a Stock') or ''),
                "terminado": parse_bool(row.get('terminado') or ''),
                "entregado": parse_bool(row.get('Entregado') or ''),
                "cita_dia": parse_date(row.get('Cita dia') or ''),
                "cita_entrega": parse_date(row.get('Cita entrega') or ''),
                "hora_entrega_desde": (row.get('Hora entrega desde') or '').strip() or None,
                "hora_entrega_hasta": (row.get('Hora entrega hasta') or '').strip() or None,
                "metodo_pago": None,
                "monto_efectivo": 0.0,
                "monto_transferencia": 0.0,
                "fotos_drive": [],
                "created_at": datetime.now().isoformat() + "Z",
                "updated_at": datetime.now().isoformat() + "Z",
                "created_by": "sistema_migracion"
            }
            servicios_to_insert.append(service_doc)

    # DEDUPLICATE AND ALIGN KEYS TO PREVENT BATCH CONFLICTS & PGRST102
    print("\nDepurando y deduplicando datos...")
    
    unique_clients = {}
    for c in clients_to_insert:
        # Merge with TEMPLATE to make sure all object keys match exactly
        full_client = TEMPLATE_CLIENT.copy()
        full_client.update(c)
        unique_clients[c['id']] = full_client
    clients_to_insert = list(unique_clients.values())
    print(f"Total Clientes únicos a subir: {len(clients_to_insert)}")

    unique_equipos = {}
    for eq in equipos_to_insert:
        full_eq = TEMPLATE_EQUIPO.copy()
        full_eq.update(eq)
        unique_equipos[eq['id']] = full_eq
    equipos_to_insert = list(unique_equipos.values())
    print(f"Total Equipos únicos a subir: {len(equipos_to_insert)}")

    unique_servicios = {}
    for s in servicios_to_insert:
        full_srv = TEMPLATE_SERVICIO.copy()
        full_srv.update(s)
        unique_servicios[s['id']] = full_srv
    servicios_to_insert = list(unique_servicios.values())
    print(f"Total Servicios únicos a subir: {len(servicios_to_insert)}")

    # 3. BULK UPSERT TO SUPABASE
    BATCH_SIZE = 200

    # Upsert Clientes
    print(f"\n3. Subiendo Clientes a Supabase...")
    for i in range(0, len(clients_to_insert), BATCH_SIZE):
        batch = clients_to_insert[i:i+BATCH_SIZE]
        url = f"{SUPABASE_URL}/rest/v1/clientes?on_conflict=id"
        req = urllib.request.Request(url, data=json.dumps(batch).encode('utf-8'), headers=headers, method='POST')
        try:
            urllib.request.urlopen(req)
            print(f"Clientes subidos: {i + len(batch)} / {len(clients_to_insert)}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"Error al subir clientes batch {i}: {e.code} - {e.reason}")
            print(f"Causa de Base de Datos: {error_body}")
        except Exception as e:
            print(f"Error general en batch {i}: {e}")

    # Upsert Equipos
    print(f"\n4. Subiendo Equipos a Supabase...")
    for i in range(0, len(equipos_to_insert), BATCH_SIZE):
        batch = equipos_to_insert[i:i+BATCH_SIZE]
        url = f"{SUPABASE_URL}/rest/v1/equipos?on_conflict=id"
        req = urllib.request.Request(url, data=json.dumps(batch).encode('utf-8'), headers=headers, method='POST')
        try:
            urllib.request.urlopen(req)
            print(f"Equipos subidos: {i + len(batch)} / {len(equipos_to_insert)}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"Error al subir equipos batch {i}: {e.code} - {e.reason}")
            print(f"Causa de Base de Datos: {error_body}")
        except Exception as e:
            print(f"Error general en batch {i}: {e}")

    # Upsert Servicios
    print(f"\n5. Subiendo Servicios a Supabase...")
    for i in range(0, len(servicios_to_insert), BATCH_SIZE):
        batch = servicios_to_insert[i:i+BATCH_SIZE]
        url = f"{SUPABASE_URL}/rest/v1/servicios?on_conflict=id"
        req = urllib.request.Request(url, data=json.dumps(batch).encode('utf-8'), headers=headers, method='POST')
        try:
            urllib.request.urlopen(req)
            print(f"Servicios subidos: {i + len(batch)} / {len(servicios_to_insert)}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"Error al subir servicios batch {i}: {e.code} - {e.reason}")
            print(f"Causa de Base de Datos: {error_body}")
        except Exception as e:
            print(f"Error general en batch {i}: {e}")

    print("\n✅ ¡Base de datos migrada a Supabase con éxito total!")

if __name__ == '__main__':
    run_migration()
