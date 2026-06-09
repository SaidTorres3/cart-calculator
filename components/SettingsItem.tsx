import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface SettingsItemProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  title,
  subtitle,
  rightElement,
  onPress,
}) => {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container 
      style={styles.container} 
      onPress={onPress} 
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.leftContainer}>
        <View style={styles.iconBackground}>
          <MaterialIcons name={icon} size={20} color="#64B5F6" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement && <View style={styles.rightContainer}>{rightElement}</View>}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#383838',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: '#9e9e9e',
    fontSize: 12,
    marginTop: 2,
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minHeight: 36,
  },
});

export default SettingsItem;
