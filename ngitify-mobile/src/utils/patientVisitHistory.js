const classifyPatientAppointments = (appointments = []) => ({
    upcoming: appointments
        .filter((item) => ['pending', 'confirmed', 'in-clinic'].includes(item?.status))
        .sort((left, right) => new Date(left.date) - new Date(right.date)),
    past: appointments
        .filter((item) => ['completed', 'cancelled'].includes(item?.status))
        .sort((left, right) => new Date(right.date) - new Date(left.date)),
});

const getInitialPastVisits = (appointments = [], limit = 4) => (
    classifyPatientAppointments(appointments).past.slice(0, limit)
);

module.exports = { classifyPatientAppointments, getInitialPastVisits };
