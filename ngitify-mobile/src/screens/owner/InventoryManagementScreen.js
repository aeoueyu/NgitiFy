// src/screens/owner/InventoryManagementScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

const INITIAL_INVENTORY = [
    { id: '1', item: 'Latex Gloves (Boxes)', qty: 45, threshold: 10 },
    { id: '2', item: 'Lidocaine Anesthetics', qty: 5, threshold: 15 }, // Low stock example
    { id: '3', item: 'Composite Resin (Syringes)', qty: 20, threshold: 10 },
    { id: '4', item: 'Dental Bibs (Packs)', qty: 8, threshold: 10 }, // Low stock example
    { id: '5', item: 'Saliva Ejectors (Bags)', qty: 30, threshold: 5 }
];

export default function InventoryManagementScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState('');

    const renderInventoryItem = ({ item }) => {
        const isLowStock = item.qty <= item.threshold;
        return (
            <View style={[styles.card, isLowStock && styles.cardLowStock]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.itemName}>{item.item}</Text>
                    {isLowStock && <Text style={styles.alertBadge}>Low Stock</Text>}
                </View>
                <View style={styles.qtyRow}>
                    <Text style={styles.qtyLabel}>Current Quantity:</Text>
                    <Text style={[styles.qtyValue, isLowStock && { color: '#d32f2f' }]}>
                        {item.qty}
                    </Text>
                </View>
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.updateBtn}>
                        <Text style={styles.updateBtnText}>Update Stock</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const filteredInventory = INITIAL_INVENTORY.filter(inv => 
        inv.item.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Inventory Status</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.content}>
                <TextInput 
                    style={styles.searchInput}
                    placeholder="Search clinic supplies..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <FlatList 
                    data={filteredInventory}
                    keyExtractor={(item) => item.id}
                    renderItem={renderInventoryItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 50 }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 60, padding: 5 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    content: { flex: 1, padding: 20 },
    searchInput: { backgroundColor: 'white', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 20, elevation: 2 },
    
    card: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#01538b' },
    cardLowStock: { borderLeftColor: '#d32f2f', backgroundColor: '#fffcfc' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    itemName: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
    alertBadge: { backgroundColor: '#ffebee', color: '#d32f2f', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
    
    qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    qtyLabel: { fontSize: 14, color: '#666' },
    qtyValue: { fontSize: 22, fontWeight: 'bold', color: '#01538b' },
    
    actionRow: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
    updateBtn: { alignSelf: 'flex-end' },
    updateBtnText: { color: '#01538b', fontWeight: 'bold', fontSize: 14 }
});