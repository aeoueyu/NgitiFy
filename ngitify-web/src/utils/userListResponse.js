export const readUserListResponse = async (response) => {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        return {
            ok: false,
            users: [],
            message: payload?.message || `Request failed with status ${response.status}.`,
        };
    }

    return {
        ok: true,
        users: Array.isArray(payload?.users)
            ? payload.users
            : (Array.isArray(payload) ? payload : []),
        message: '',
    };
};
