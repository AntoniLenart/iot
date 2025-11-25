import { useState, useEffect } from "react";
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT } = getConfig();

// Pobieranie danych użytkownika
const useUsersData = (refreshTrigger) => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  
  const fetchUsers = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/users/list');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [refreshTrigger]);

  return { users, usersError: error, fetchUsers };
};

export default function UserGroupsPage() {
  const [rooms, setRooms] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("group"); 
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: "",
  });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [roomFormData, setRoomFormData] = useState({ room_id: "" });
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [weekDays, setWeekDays] = useState({
    mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false,
  });
  const [hours, setHours] = useState({
    time_from: "",
    time_to: "",
  });

  // Nowe stany dla zarządzania użytkownikami w grupach
  const [groupUsers, setGroupUsers] = useState([]); // Użytkownicy należący do wybranej grupy (user_id, name)
  const [userIdToAdd, setUserIdToAdd] = useState(""); // ID użytkownika do dodania

  const { users, usersError, fetchUsers } = useUsersData(refreshTrigger);


  // Pobieranie danych
  
  const fetchRooms = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + "/api/v1/rooms/list");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + "/api/v1/user_groups/list");
      if (!response.ok) throw new Error("Failed to fetch user_groups list");
      const data = await response.json();
      setGroups(data.user_groups || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchGroupUsers = async (groupId) => {
    if (!groupId) {
      setGroupUsers([]);
      return;
    }
    setLoading(true);
    try {
      // Wymaga endpointu: GET /api/v1/user_access_groups/getByGroup/:groupId
      const response = await fetch(`${SERVER_ENDPOINT}/api/v1/user_access_groups/get?group_id=${groupId}`);
      if (!response.ok) throw new Error("Nie udało się pobrać użytkowników grupy");
      const data = await response.json();

      console.log(data)
      console.log(users)
      
      const groupMembers = (data.users || [])
            .map(groupUser => {
                // Szukamy użytkownika w naszym głównym, wzbogaconym stanie 'users'
                const fullUser = users.find(u => u.user_id === groupUser.user_id);
                
                // Zwracamy obiekt, używając sklejonego 'name' z fullUser
                return fullUser ? { ...groupUser, name: fullUser.username } : groupUser; 
            })
            .filter(Boolean);

      setGroupUsers(groupMembers);
    } catch (err) {
      setMessage("Błąd pobierania użytkowników grupy: " + err.message);
      setGroupUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Uruchamianie pobierania danych na start ---
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRooms(), fetchGroups(), fetchUsers()])
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  // Automatyczne odświeżanie
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Odświeżanie listy użytkowników w grupie po zmianie grupy lub taba
  useEffect(() => {
    if (activeTab === "users" && editingGroupId) {
      fetchGroupUsers(editingGroupId);
    } else {
      setGroupUsers([]);
    }
  }, [activeTab, editingGroupId, refreshTrigger, users]);


  // --- Handlers ---

  const handleGroupChange = (e) => {
    setGroupFormData({ ...groupFormData, [e.target.name]: e.target.value });
  };

  const handleRoomChange = (e) => {
    setRoomFormData({ ...roomFormData, [e.target.name]: e.target.value });
  };

  const handleHoursChange = (e) => {
    setHours({ ...hours, [e.target.name]: e.target.value });
  };

  const toggleDay = (day) => {
    setWeekDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const handleAddRoom = () => {
    if (!roomFormData.room_id) return;
    const room = rooms.find((r) => r.room_id === roomFormData.room_id);
    if (!room) return;

    if (selectedRooms.some((r) => r.room_id === room.room_id)) {
      setRoomFormData({ ...roomFormData, room_id: "" });
      return;
    }

    setSelectedRooms((prev) => [...prev, room]);
    setRoomFormData({ ...roomFormData, room_id: "" });
  };

  const handleRemoveRoom = (room_id) => {
    setSelectedRooms((prev) => prev.filter((r) => r.room_id !== room_id));
  };

  const resetForm = () => {
    setEditingGroupId(null);
    setGroupFormData({ name: "", description: "" });
    setSelectedRooms([]);
    setWeekDays({
      mon: false, tue: false, wed: false, thu: false,
      fri: false, sat: false, sun: false
    });


    setHours({ time_from: "", time_to: "" });
    setGroupUsers([]);
    setUserIdToAdd("");
    setMessage(""); // Resetuj wiadomość
  }

  const loadGroupData = async (group_id) => {
    if (!group_id) {
      resetForm();
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // user_groups
      const groupResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/user_groups/get?group_id=${group_id}`);
      if (!groupResponse.ok) throw new Error("Krok 1: Nie udało się pobrać danych grupy");
      const groupData = await groupResponse.json();

      console.log(group_id)

      setEditingGroupId(group_id);
      setGroupFormData({
        name: groupData.user_group.name || "",
        description: groupData.user_group.description || ""
      });

      // group_policies
      // Zakładamy, że grupa ma tylko jedną politykę
      const gpResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/group_policies/get?group_id=${group_id}`);
      if (!gpResponse.ok) throw new Error("Krok 2: Nie udało się pobrać powiązanej polityki (group_policies)");
      const gpData = await gpResponse.json();

      const policyId = gpData.group_policy.policy_id;
      console.log(policyId)

      if (!policyId) {
        // Jeśli grupa nie ma polityki, resetujemy powiązane stany i kończymy.
        setSelectedRooms([]);
        setWeekDays({ mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false });
        setHours({ time_from: "", time_to: "" });
        
        if (activeTab === "users") {
          await fetchGroupUsers(group_id);
        }
        return;
      }
      
      // access_policies
      const policyResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/access_policies/get?policy_id=${policyId}`);
      if (!policyResponse.ok) throw new Error("Krok 3: Nie udało się pobrać szczegółów polityki (access_policies)");
      const policyData = await policyResponse.json();

      console.log(policyData)

      const metadata = policyData.access_policy.metadata || {};
      
      const timeRanges = metadata.days?.time_ranges || [];
      const daysObj = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false };
      let timeFrom = "";
      let timeTo = "";

      if (timeRanges.length > 0) {
        // Zakładamy, że wszystkie reguły czasowe w polityce mają te same godziny
        timeFrom = timeRanges[0].start;
        timeTo = timeRanges[0].end;

        // Ustawienie dni jako true
        timeRanges.forEach(range => {
          if (daysObj.hasOwnProperty(range.day)) {
            daysObj[range.day] = true;
          }
        });
      }

      console.log(daysObj)

      setWeekDays(daysObj);
      setHours({
        time_from: timeFrom,
        time_to: timeTo
      });

      console.log(weekDays)
      
      // policy_rules
      const rulesResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/policy_rules/get?policy_id=${policyId}`);
      if (!rulesResponse.ok) throw new Error("Krok 4: Nie udało się pobrać reguł pokojów (policy_rules)");
      const rulesData = await rulesResponse.json();
      
      console.log(rulesData.policy_rules)

      const ruleRoomIds = (rulesData.policy_rules || []).map(r => r.room_id);

      console.log(ruleRoomIds)

      // Konwersja room_id na obiekty pokojów do stanu selectedRooms
      const roomObjects = ruleRoomIds
        .map(roomId => rooms.find(r => r.room_id === roomId))
        .filter(Boolean);

      console.log(roomObjects)
      
      setSelectedRooms(roomObjects);

      // --- KROK 5: Pobierz użytkowników grupy (jeśli na odpowiedniej zakładce) ---
      if (activeTab === "users") {
        await fetchGroupUsers(group_id);
      }

    } catch (err) {
      setMessage("Błąd ładowania danych dostępu: " + err.message);
      setSelectedRooms([]);
      setWeekDays({ mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false });
      setHours({ time_from: "", time_to: "" });
    } finally {
      setLoading(false);
    }
};


  // Grupy

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
        const groupPayload = {
            name: groupFormData.name,
            description: groupFormData.description,
        };
        
        // 1. user_groups
        const groupResponse = await fetch(SERVER_ENDPOINT + "/api/v1/user_groups/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(groupPayload)
        });

        if (!groupResponse.ok) {
            const errData = await groupResponse.json().catch(() => ({}));
            throw new Error(`Krok 1 (Grupa): ${errData.error || "Nie udało się utworzyć grupy"}`);
        }
        const groupData = await groupResponse.json();
        const newGroupId = groupData.user_group.group_id;
        const groupName = groupData.user_group.name;

        console.log(newGroupId)
        console.log(groupName)

        const activeDays = Object.entries(weekDays).filter(([_, v]) => v).map(([k]) => k);
        const policyMetadata = {
            active_days: activeDays.length > 0,
            active_times: !!hours.time_from && !!hours.time_to,
            days: {
                "time_ranges": activeDays.map(day => ({ 
                    day: day, 
                    start: hours.time_from, 
                    end: hours.time_to 
                }))
            }
        };

        console.log(policyMetadata)

        const policyPayload = {
            name: `Policy for Group: ${groupName}`,
            description: `Automatyczna polityka dostępu dla grupy ${groupName}.`,
            action: 'allow',
            is_active: true,
            metadata: policyMetadata
        };

        // 2. access_policies
        const policyResponse = await fetch(SERVER_ENDPOINT + "/api/v1/access_policies/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(policyPayload)
        });
        
        if (!policyResponse.ok) {
            const errData = await policyResponse.json().catch(() => ({}));
            throw new Error(`Krok 2 (Polityka): ${errData.error || "Nie udało się utworzyć polityki dostępu"}`);
        }
        const policyData = await policyResponse.json();
        const newPolicyId = policyData.access_policy.policy_id;

        console.log(newPolicyId)

        // 3. policy_rules
        if (selectedRooms.length > 0) {
            const roomPromises = selectedRooms.map(room => {
                const rulePayload = {
                    policy_id: newPolicyId,
                    room_id: room.room_id,
                    is_active: true,
                    rules: {}, 
                    metadata: {}
                };

                return fetch(SERVER_ENDPOINT + "/api/v1/policy_rules/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rulePayload)
                });
            });

            const roomResponses = await Promise.all(roomPromises);

            for (let i = 0; i < roomResponses.length; i++) {
                if (!roomResponses[i].ok) {
                    const errData = await roomResponses[i].json().catch(() => ({}));
                    throw new Error(`Krok 3 (Reguła dla pokoju ${selectedRooms[i].name}): ${errData.error || "Błąd podczas tworzenia reguły pokoju"}`);
                }
            }
        }
        
        // 4. group_policies
        const groupPolicyPayload = {
            group_id: newGroupId,
            policy_id: newPolicyId
        };
        const groupPolicyResponse = await fetch(SERVER_ENDPOINT + "/api/v1/group_policies/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(groupPolicyPayload)
        });

        if (!groupPolicyResponse.ok) {
            const errData = await groupPolicyResponse.json().catch(() => ({}));
            throw new Error(`Krok 4 (Powiązanie): ${errData.error || "Nie udało się powiązać grupy z polityką"}`);
        }

        setMessage("Grupa, polityka dostępu, reguły pokojów oraz powiązanie zostały utworzone pomyślnie!");

        resetForm();
        setRefreshTrigger((prev) => prev + 1);

    } catch (err) {
        setMessage("Błąd tworzenia infrastruktury dostępu: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!editingGroupId) {
        setMessage("Najpierw wybierz grupę do edycji.");
        return;
    }

    setLoading(true);
    setMessage("");

    try {
        const groupId = editingGroupId;
        
        // 1. POBIERZ POLICY ID powiązane z grupą
        const gpResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/group_policies/get?group_id=${groupId}`);
        if (!gpResponse.ok) throw new Error("Krok 1: Nie udało się pobrać powiązanej polityki (group_policies)");
        const gpData = await gpResponse.json();
        const policyId = gpData.group_policy.policy_id; 

        if (!policyId) throw new Error("Brak powiązanej polityki dostępu do aktualizacji.");

        // 2. AKTUALIZUJ GRUPĘ (user_groups)
        const groupPayload = {
            group_id: groupId,
            name: groupFormData.name,
            description: groupFormData.description,
        };
        const groupResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/user_groups/update`, { 
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(groupPayload)
        });

        if (!groupResponse.ok) throw new Error("Krok 2: Nie udało się zaktualizować danych grupy");
        
        // 3. AKTUALIZUJ POLITYKĘ (access_policies) - dni i godziny
        const activeDays = Object.entries(weekDays).filter(([_, v]) => v).map(([k]) => k);
        const policyMetadata = {
            active_days: activeDays.length > 0,
            active_times: !!hours.time_from && !!hours.time_to,
            days: {
                "time_ranges": activeDays.map(day => ({ 
                    day: day, 
                    start: hours.time_from, 
                    end: hours.time_to 
                }))
            }
        };

        const policyPayload = {
            policy_id: policyId,
            metadata: policyMetadata
        };
        const policyResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/access_policies/update`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(policyPayload)
        });
        if (!policyResponse.ok) throw new Error("Krok 3: Nie udało się zaktualizować polityki dostępu");


        // 4. AKTUALIZUJ REGUŁY POKOJÓW (policy_rules) - Wymaga czyszczenia i tworzenia na nowo

        // 4a. POBIERZ i USUŃ ISTNIEJĄCE REGUŁY
        const existingRulesResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/policy_rules/get?policy_id=${policyId}`);
        const existingRulesData = await existingRulesResponse.json();
        const existingRuleIds = (existingRulesData.policy_rules || []).map(r => r.policy_rule_id);

        const deletePromises = existingRuleIds.map(ruleId => 
            fetch(SERVER_ENDPOINT + "/api/v1/policy_rules/remove", { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ policy_rule_id: ruleId }) 
            })
        );
        await Promise.all(deletePromises); // Usuń wszystkie stare reguły

        // 4b. STWÓRZ NOWE REGUŁY (tylko jeśli wybrano pokoje)
        if (selectedRooms.length > 0) {
            const createPromises = selectedRooms.map(room => {
                const rulePayload = {
                    policy_id: policyId,
                    room_id: room.room_id,
                    is_active: true,
                    rules: {}, 
                    metadata: {}
                };
                return fetch(SERVER_ENDPOINT + "/api/v1/policy_rules/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(rulePayload)
                });
            });
            const createResponses = await Promise.all(createPromises);
             for (let i = 0; i < createResponses.length; i++) {
                if (!createResponses[i].ok) {
                    const errData = await createResponses[i].json().catch(() => ({}));
                    throw new Error(`Krok 4: Błąd podczas tworzenia nowej reguły dla pokoju ${selectedRooms[i].name}`);
                }
            }
        }
        
        setMessage("Zmiany zapisane pomyślnie! Zaktualizowano grupę, politykę dostępu i reguły pokojów.");
        setRefreshTrigger((prev) => prev + 1);

    } catch (err) {
        setMessage("Błąd zapisu zmian dostępu: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!editingGroupId) {
        setMessage("Najpierw wybierz grupę do usunięcia.");
        return;
    }

    const confirmDelete = window.confirm("Czy na pewno chcesz usunąć tę grupę? Usunięte zostaną także powiązane polityki dostępu i reguły pokojów.");
    if (!confirmDelete) return;

    setLoading(true);
    setMessage("");

    try {
        const groupId = editingGroupId;
        let policyId = null;

        // --- KROK 1: POBIERZ POLICY ID ---
        const gpResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/group_policies/get?group_id=${groupId}`);
        if (!gpResponse.ok) throw new Error("Krok 1: Nie udało się pobrać powiązanej polityki (group_policies)");
        const gpData = await gpResponse.json();
        
        policyId = gpData.group_policy.policy_id; 
        
        // --- KROK 2: USUŃ REGUŁY POKOJÓW (policy_rules) ---
        if (policyId) {
            setMessage("Usuwanie reguł pokojów...");
            const existingRulesResponse = await fetch(`${SERVER_ENDPOINT}/api/v1/policy_rules/get?policy_id=${policyId}`);
            const existingRulesData = await existingRulesResponse.json();
            const existingRuleIds = (existingRulesData.policy_rules || []).map(r => r.policy_rule_id);

            // 2b. Usuń reguły równolegle
            const deleteRulePromises = existingRuleIds.map(ruleId => 
                fetch(SERVER_ENDPOINT + "/api/v1/policy_rules/remove", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" }, 
                    body: JSON.stringify({ policy_rule_id: ruleId }) 
                })
            );
            await Promise.all(deleteRulePromises);
        }

        // --- KROK 3: USUŃ POWIĄZANIA (group_policies) ---
        if (policyId) {
            setMessage("Usuwanie powiązania Grupa <-> Polityka...");
            // Uwaga: Jeśli używasz ON DELETE CASCADE w bazie, to powiązanie może być
            // usunięte automatycznie przy usuwaniu grupy lub polityki, ale lepiej usunąć jawnie.
            const gpRemovePayload = { group_id: groupId, policy_id: policyId };
            await fetch(SERVER_ENDPOINT + "/api/v1/group_policies/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(gpRemovePayload)
            });
        }
        
        // --- KROK 4: USUŃ POLITYKĘ DOSTĘPU (access_policies) ---
        if (policyId) {
            setMessage("Usuwanie polityki dostępu...");
            const policyRemovePayload = { policy_id: policyId };
            const policyResponse = await fetch(SERVER_ENDPOINT + "/api/v1/access_policies/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(policyRemovePayload)
            });
            if (!policyResponse.ok) {
                 const errData = await policyResponse.json().catch(() => ({}));
                 throw new Error(`Krok 4: ${errData.error || "Nie udało się usunąć polityki dostępu"}`);
            }
        }
        
        // --- KROK 5: USUŃ GRUPĘ (user_groups) ---
        // Zakończenie procesu i usunięcie głównego rekordu
        setMessage("Usuwanie grupy...");
        const groupResponse = await fetch(SERVER_ENDPOINT + "/api/v1/user_groups/remove", {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group_id: groupId }) 
        });

        if (!groupResponse.ok) {
            const errData = await groupResponse.json().catch(() => ({}));
            throw new Error(`Krok 5: ${errData.error || "Nie udało się usunąć grupy"}`);
        }

        // --- SUKCES ---
        setMessage("Grupa, polityka dostępu i powiązane reguły zostały usunięte.");

        // Resetowanie formularza i odświeżanie
        resetForm();
        setRefreshTrigger(prev => prev + 1);

    } catch (err) {
        setMessage("Błąd usuwania grupy dostępu: " + err.message);
    } finally {
        setLoading(false);
    }
};
  
  // Użytkowników w Grupie

  const handleAddUserToGroup = async (e) => {
    e.preventDefault();
    if (!editingGroupId || !userIdToAdd) {
      setMessage("Wybierz grupę i użytkownika.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        user_id: userIdToAdd,
        group_id: editingGroupId,
        assigned_by: JSON.parse(localStorage.getItem('user')).user_id
      }

      // Używa Twojego endpointu: POST /api/v1/user_access_groups/create
      const response = await fetch(SERVER_ENDPOINT + "/api/v1/user_access_groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Nie udało się dodać użytkownika do grupy");
      }

      setMessage("Użytkownik dodany pomyślnie!");
      setUserIdToAdd("");
      setRefreshTrigger((prev) => prev + 1); // Odśwież listę użytkowników w grupie
    } catch (err) {
      setMessage("Błąd dodawania użytkownika: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUserFromGroup = async (userId) => {
    if (!editingGroupId) {
      setMessage("Najpierw wybierz grupę.");
      return;
    }

    const userName = users.find(u => u.user_id === userId)?.name || userId;
    const confirmDelete = window.confirm(`Czy na pewno chcesz usunąć użytkownika ${userName} z tej grupy?`);
    if (!confirmDelete) return;

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        user_id: userId,
        group_id: editingGroupId
      };

      // Używa Twojego endpointu: POST /api/v1/user_access_groups/remove
      const response = await fetch(SERVER_ENDPOINT + "/api/v1/user_access_groups/remove", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Nie udało się usunąć użytkownika z grupy");
      }

      setMessage("Użytkownik usunięty z grupy pomyślnie!");
      setRefreshTrigger((prev) => prev + 1); // Odśwież listę użytkowników w grupie
    } catch (err) {
      setMessage("Błąd usuwania użytkownika: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Ładowanie...</div>;
  if (error || usersError) return <div>Błąd: {error || usersError}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-4xl font-semibold mb-6">Zarządzanie grupami użytkowników 👥</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.includes("Błąd") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`py-2 px-4 ${
            activeTab === "group" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
          }`}
          onClick={() => {
            setActiveTab("group");
            resetForm();
          }}
        >
          ➕ Dodaj Grupę
        </button>
        <button
          className={`py-2 px-4 ${
            activeTab === "edit" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("edit")}
        >
          ✍️ Edytuj Grupę
        </button>
        <button
          className={`py-2 px-4 ${
            activeTab === "users" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("users")}
        >
          👥 Użytkownicy
        </button>
      </div>
      
      {/* --------------------------------------------------------------------------------- */}
      {/* --- Sekcja wyboru grupy do Edycji/Użytkowników --- */}
      {(activeTab === "edit" || activeTab === "users") && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-2">Wybierz grupę</label>
          <select
            value={editingGroupId || ""}
            onChange={(e) => {
              const gid = e.target.value;
              loadGroupData(gid);
            }}
            className="w-full border rounded-lg p-2"
            disabled={loading}
          >
            <option value="">-- Wybierz grupę --</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {/* --------------------------------------------------------------------------------- */}


      {/* --- WIDOK: DODAJ GRUPĘ --- */}
      {activeTab === "group" && (
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nazwa grupy *</label>
            <input
              type="text"
              name="name"
              value={groupFormData.name}
              onChange={handleGroupChange}
              required
              placeholder="Wprowadź nazwę grupy"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Opis</label>
            <input
              type="text"
              name="description"
              value={groupFormData.description}
              onChange={handleGroupChange}
              placeholder="Wprowadź opis grupy dostępowej"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pokoje */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Dodaj pokój</label>
            <div className="flex gap-2">
              <select
                name="room_id"
                value={roomFormData.room_id}
                onChange={handleRoomChange}
                className="w-full border rounded-lg p-2"
              >
                <option value="">Wybierz pokój</option>
                {rooms.map((r) => (
                  <option key={r.room_id} value={r.room_id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddRoom}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Dodaj
              </button>
            </div>

            {selectedRooms.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Wybrane pokoje:</h4>
                <div className="flex flex-wrap mt-2 gap-2">
                  {selectedRooms.map((r) => (
                    <div
                      key={r.room_id}
                      className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                    >
                      <span>{r.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRoom(r.room_id)}
                        className="ml-2 text-blue-800 font-bold"
                        aria-label={`Usuń ${r.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dni tygodnia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dni obowiązywania</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(weekDays).map((day) => (
                <label key={day} className="flex items-center gap-2">
                  <input type="checkbox" checked={weekDays[day]} onChange={() => toggleDay(day)} />
                  {day.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* Godziny */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Od *</label>
              <input
                type="time"
                name="time_from"
                value={hours.time_from}
                onChange={handleHoursChange}
                required
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Do *</label>
              <input
                type="time"
                name="time_to"
                value={hours.time_to}
                onChange={handleHoursChange}
                required
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Tworzenie..." : "Dodaj grupę"}
          </button>
        </form>
      )}

      {/* --- WIDOK: EDYTUJ GRUPĘ --- */}
      {activeTab === "edit" && editingGroupId && (
        <form onSubmit={handleSaveGroup} className="space-y-4">   
          <div>
            <label className="block text-sm font-medium text-gray-700">Nazwa grupy *</label>
            <input
              type="text"
              name="name"
              value={groupFormData.name}
              onChange={handleGroupChange}
              required
              placeholder="Wprowadź nazwę grupy"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Opis</label>
            <input
              type="text"
              name="description"
              value={groupFormData.description}
              onChange={handleGroupChange}
              placeholder="Wprowadź opis grupy dostępowej"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pokoje */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Dodaj pokój</label>
            <div className="flex gap-2">
              <select
                name="room_id"
                value={roomFormData.room_id}
                onChange={handleRoomChange}
                className="w-full border rounded-lg p-2"
              >
                <option value="">Wybierz pokój</option>
                {rooms.map((r) => (
                  <option key={r.room_id} value={r.room_id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddRoom}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Dodaj
              </button>
            </div>

            {selectedRooms.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Wybrane pokoje:</h4>
                <div className="flex flex-wrap mt-2 gap-2">
                  {selectedRooms.map((r) => (
                    <div
                      key={r.room_id}
                      className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                    >
                      <span>{r.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRoom(r.room_id)}
                        className="ml-2 text-blue-800 font-bold"
                        aria-label={`Usuń ${r.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dni tygodnia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dni obowiązywania</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(weekDays).map((day) => (
                <label key={day} className="flex items-center gap-2">
                  <input type="checkbox" checked={weekDays[day]} onChange={() => toggleDay(day)} />
                  {day.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* Godziny */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Od *</label>
              <input
                type="time"
                name="time_from"
                value={hours.time_from}
                onChange={handleHoursChange}
                required
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Do *</label>
              <input
                type="time"
                name="time_to"
                value={hours.time_to}
                onChange={handleHoursChange}
                required
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
          {editingGroupId && (
            <button
              type="button"
              onClick={handleDeleteGroup}
              className="w-full mt-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
            >
              Usuń grupę
            </button>
          )}
        </form>
      )}

      {/* --- WIDOK: UŻYTKOWNICY W GRUPIE --- */}
      {activeTab === "users" && editingGroupId && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold mb-4">Zarządzanie użytkownikami grupy: **{groupFormData.name}**</h3>

          {/* Formularz dodawania użytkownika */}
          <form onSubmit={handleAddUserToGroup} className="p-4 border rounded-lg shadow-sm bg-white space-y-3">
            <h4 className="font-medium">➕ Dodaj użytkownika do grupy</h4>
            <div className="flex gap-2">
              <select
                value={userIdToAdd}
                onChange={(e) => setUserIdToAdd(e.target.value)}
                className="w-full border rounded-lg p-2"
                required
                disabled={loading}
              >
                <option value="">Wybierz użytkownika</option>
                {/* Filtruj użytkowników, którzy JUŻ są w grupie */}
                {users
                  .filter(u => !groupUsers.some(gu => gu.user_id === u.user_id))
                  .map((u) => (
                     <option key={u.user_id} value={u.user_id}>
                       {u.user_id} — {u.first_name} {u.last_name}
                      </option>
                  ))}
              </select>

              <button
                type="submit"
                disabled={loading || !userIdToAdd}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Dodaj
              </button>
            </div>
          </form>

          {/* Lista użytkowników w grupie */}
          <div className="p-4 border rounded-lg shadow-sm bg-white">
            <h4 className="font-medium mb-2">Aktualni użytkownicy w grupie ({groupUsers.length}):</h4>
            {groupUsers.length === 0 ? (
              <p className="text-gray-500">Brak użytkowników w tej grupie.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {groupUsers.map((u) => (
                  <li key={u.user_id} className="flex justify-between items-center py-2">
                    <span>{u.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUserFromGroup(u.user_id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                      disabled={loading}
                    >
                      Usuń
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Komunikat o braku wybranej grupy */}
      {(activeTab === "edit" || activeTab === "users") && !editingGroupId && (
        <div className="text-sm text-gray-600">Wybierz grupę, aby edytować jej ustawienia lub zarządzać użytkownikami.</div>
      )}
    </div>
  );
}