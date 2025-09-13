import type { CollaborationState } from "@/types";
import { createContext, useContext, useReducer } from "react";

interface CollabAction {
    type: 'SET_USER' | 'SET_ROOM' | 'START_COLLABORATION' | 'END_COLLABORATION' | 'UPDATE_COLLABORATORS' | 'SET_CREATOR';
    payload: any; 
}

const initialState: CollaborationState = {
    isCollaborating: false,
    currentRoom: null,
    currentUser: null,
    collaborators: [],
    isCreator: false
};

const CollabContext = createContext<{
    state: CollaborationState;
    dispatch: React.Dispatch<CollabAction>;
    endCollabSession: () => void;
} | null>(null);

const collabReducer = (state: CollaborationState, action: CollabAction): CollaborationState => {
    let newCollabs: any[] = [];
    switch (action.type) {
        case 'SET_USER':
            return {
                ...state,
                currentUser: action.payload,
            };
        case 'SET_ROOM':
            return {
                ...state,
                currentRoom: action.payload,
            };
        case 'START_COLLABORATION':
            // Save user info to localStorage when starting collaboration
            if (typeof window !== 'undefined' && action.payload.user) {
                localStorage.setItem('collaborative-user', JSON.stringify(action.payload.user));
            }
            return {
                ...state,
                isCollaborating: true,
                currentRoom: action.payload.room,
                currentUser: action.payload.user,
                isCreator: action.payload.isCreator || false
            };
        case 'END_COLLABORATION':
            // Clean up localStorage when ending collaboration
            if (typeof window !== 'undefined') {
                localStorage.removeItem('collaborative-user');
            }
            return {
                ...state,
                isCollaborating: false,
                currentRoom: null,
                currentUser: null,
                collaborators: [],
                isCreator: false
            };
        case 'UPDATE_COLLABORATORS':
            newCollabs = Array.isArray(action.payload) ? action.payload : [action.payload];
            return {
                ...state,
                collaborators: [
                ...state.collaborators.filter(c => !newCollabs.some(nc => nc.id === c.id)),
                ...newCollabs
                ],
            };


        case 'SET_CREATOR':
            return {
                ...state,
                isCreator: action.payload,
            };
        default:
            return state;
    }
};


export function CollabProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(collabReducer, initialState);

    const endCollabSession = () => {
        dispatch({ type: 'END_COLLABORATION', payload: null });
    };

    return (
        <CollabContext.Provider value={{ state, dispatch, endCollabSession }}>
            {children}
        </CollabContext.Provider>
    );
}

export function useCollab() {
    const context = useContext(CollabContext);
    if (!context) {
        throw new Error("useCollab must be used within a CollabProvider");
    }
    return context;
}